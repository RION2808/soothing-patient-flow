import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Activity, Ambulance, ArrowRight, BedDouble, CircleAlert, HeartPulse,
  Import, LayoutDashboard, Menu, PackageCheck, Radio, Search, Stethoscope,
  UserRoundPlus, UsersRound, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calculateTriage, erlangB, type TriageResult, type Vitals } from "@/lib/triage";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Live Floor — CureOps" },
    { name: "description", content: "Coordinate hospital triage, beds, clinical teams, equipment, and ambulances in real time." },
    { property: "og:title", content: "Live Floor — CureOps" },
    { property: "og:description", content: "Coordinate hospital triage, beds, clinical teams, equipment, and ambulances in real time." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

type Section = "live" | "intake" | "beds" | "records" | "analytics";
type Patient = { id: string; name: string; age: number; category: "GREEN" | "YELLOW" | "RED"; stage: number; room: string; status: "queue" | "treatment" | "discharged"; vitals: string; team: string; note: string };

const initialPatients: Patient[] = [
  { id: "PT-10255", name: "Leah Fontaine", age: 41, category: "GREEN", stage: 2, room: "G-02", status: "treatment", vitals: "104 bpm · SpO₂ 96% · 124/80", team: "Dr. Arun Vaidya · Nurse Ivy Chen", note: "Mild breathlessness" },
  { id: "PT-10241", name: "Aarav Sharma", age: 29, category: "GREEN", stage: 1, room: "G-01", status: "treatment", vitals: "72 bpm · SpO₂ 99% · 118/76", team: "Dr. Sana Qureshi · Nurse Ella Park", note: "Routine consultation" },
  { id: "PT-10302", name: "Maya Singh", age: 46, category: "YELLOW", stage: 4, room: "Y-03", status: "treatment", vitals: "118 bpm · SpO₂ 92% · 151/94", team: "Dr. Samuel Otieno · Nurse Bea Santos", note: "Persistent chest discomfort" },
  { id: "PT-10310", name: "Noah Williams", age: 34, category: "YELLOW", stage: 3, room: "Waiting", status: "queue", vitals: "108 bpm · SpO₂ 95% · 145/91", team: "Assignment pending", note: "Observation requested" },
  { id: "PT-10262", name: "Ibrahim Yusuf", age: 63, category: "RED", stage: 5, room: "R-01", status: "treatment", vitals: "112 bpm · SpO₂ 93% · 158/96", team: "Dr. Helen Voss · Nurse Yusuf Demir", note: "Bleeding, dressing required" },
  { id: "PT-10288", name: "Victor Almeida", age: 58, category: "RED", stage: 5, room: "R-02", status: "treatment", vitals: "138 bpm · SpO₂ 84% · 84/55", team: "Dr. Farah Idris · Nurse Grace Miller", note: "Immediate respiratory support" },
];

const beds = {
  GREEN: ["G-01", "G-02", "G-03", "G-04", "G-05", "G-06"],
  YELLOW: ["Y-01", "Y-02", "Y-03", "Y-04", "Y-05", "Y-06", "Y-07", "Y-08"],
  RED: ["R-01", "R-02", "R-03", "R-04", "R-05", "R-06", "R-07", "R-08"],
};

const nav: { id: Section; label: string; icon: typeof Activity }[] = [
  { id: "live", label: "Live floor", icon: LayoutDashboard }, { id: "intake", label: "Patient intake", icon: UserRoundPlus },
  { id: "beds", label: "Bed board", icon: BedDouble }, { id: "records", label: "Records", icon: PackageCheck },
  { id: "analytics", label: "Analytics", icon: Activity },
];

function Index() {
  const [section, setSection] = useState<Section>("live");
  const [mobileNav, setMobileNav] = useState(false);
  const [patients, setPatients] = useState(initialPatients);
  const [result, setResult] = useState<(TriageResult & { id: string; name: string; age: number; gender: string; vitals: Vitals }) | null>(null);
  const [gridlockOpen, setGridlockOpen] = useState(false);
  const livePatients = patients.filter((p) => p.status !== "discharged");
  const blocking = erlangB(14.8, 16);
  const occupied = livePatients.filter((p) => p.room !== "Waiting").length;

  const go = (next: Section) => { setSection(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-4 px-4 sm:px-6">
          <button type="button" aria-label="Open navigation" className="md:hidden" onClick={() => setMobileNav(!mobileNav)}><Menu className="size-5" /></button>
          <button type="button" onClick={() => go("live")} className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><HeartPulse className="size-5" /></span>
            <span className="text-left"><strong className="block font-display text-base leading-none">CureOps</strong><span className="text-[10px] uppercase tracking-[.22em] text-muted-foreground">Resource control</span></span>
          </button>
          <nav className="ml-8 hidden items-center gap-1 md:flex">
            {nav.map((item) => <button key={item.id} type="button" onClick={() => go(item.id)} className={`px-3 py-2 text-sm font-medium ${section === item.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="size-2 rounded-full bg-success" /> Floor clock T+14m</span>
            <Button onClick={() => go("intake")}><UserRoundPlus /> <span className="hidden sm:inline">Add patient</span></Button>
            <div className="hidden text-xs lg:block"><strong className="block">Avirath Bora</strong><span className="text-muted-foreground">Clinical admin</span></div>
          </div>
        </div>
        {mobileNav && <nav className="grid border-t border-border bg-surface p-2 md:hidden">{nav.map((item) => <button key={item.id} onClick={() => go(item.id)} className="flex items-center gap-3 px-3 py-3 text-sm"><item.icon className="size-4" />{item.label}</button>)}</nav>}
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:py-8">
        {section === "live" && <LiveFloor patients={livePatients} occupied={occupied} onDischarge={(id) => setPatients((all) => all.map((p) => p.id === id ? { ...p, status: "discharged" } : p))} onNavigate={go} onGridlock={() => setGridlockOpen(true)} blocking={blocking} />}
        {section === "intake" && <Intake result={result} setResult={setResult} onAdmit={(patient) => { setPatients((all) => [patient, ...all]); }} />}
        {section === "beds" && <BedBoard patients={livePatients} />}
        {section === "records" && <Records patients={patients} />}
        {section === "analytics" && <Analytics blocking={blocking} onGridlock={() => setGridlockOpen(true)} />}
      </main>

      <Dialog open={gridlockOpen} onOpenChange={setGridlockOpen}>
        <DialogContent className="border-critical/30">
          <DialogHeader><div className="mb-2 grid size-11 place-items-center rounded-full bg-critical-soft text-critical"><CircleAlert /></div><DialogTitle>Capacity escalation required</DialogTitle><DialogDescription>Gridlock probability has crossed the hospital’s 20% concern threshold.</DialogDescription></DialogHeader>
          <div className="rounded-md bg-critical-soft p-4 text-sm text-foreground"><strong>Recommended action:</strong> contact nearby hospitals for transfer availability, open overflow capacity, and call in the reserve clinical team.</div>
          <Button onClick={() => setGridlockOpen(false)}>Acknowledge alert</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LiveFloor({ patients, occupied, onDischarge, onNavigate, onGridlock, blocking }: { patients: Patient[]; occupied: number; onDischarge: (id: string) => void; onNavigate: (s: Section) => void; onGridlock: () => void; blocking: number }) {
  return <>
    <section className="clinical-shadow mb-6 grid gap-8 rounded-lg bg-primary p-7 text-primary-foreground lg:grid-cols-[1fr_auto] lg:items-end lg:p-9">
      <div><p className="mb-2 text-xs font-bold uppercase tracking-[.24em] text-primary-foreground/70">Live floor</p><h1 className="text-3xl font-extrabold">Calm control for every critical minute.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/80">{patients.length} patients are active across three acuity groups. Red receives absolute priority, and every discharge returns a bed and care team to the pool.</p></div>
      <div className="grid grid-cols-3 gap-8"><Metric value="22" label="Beds in service" /><Metric value="28" label="Clinical staff" /><Metric value={`${Math.round(blocking * 100)}%`} label="Gridlock risk" /></div>
    </section>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">{(["RED", "YELLOW", "GREEN"] as const).map((category) => <CareGroup key={category} category={category} patients={patients.filter((p) => p.category === category)} onDischarge={onDischarge} />)}</div>
      <aside className="space-y-5"><Workforce /><CapacityCard occupied={occupied} onNavigate={onNavigate} /><TrendCard /><Updates /><div className="rounded-lg border border-warning/30 bg-warning-soft p-4"><p className="text-xs font-bold uppercase tracking-[.18em] text-warning">Erlang-B gridlock</p><button onClick={onGridlock} className="mt-2 text-left text-sm"><strong>B(14.8 Erlangs, 16 beds) = {(blocking * 100).toFixed(1)}%</strong> — concerning, review escalation <ArrowRight className="inline size-4" /></button></div></aside>
    </div>
  </>;
}

function Metric({ value, label }: { value: string; label: string }) { return <div><strong className="block font-display text-3xl">{value}</strong><span className="text-[10px] uppercase text-primary-foreground/65">{label}</span></div>; }

function CareGroup({ category, patients, onDischarge }: { category: Patient["category"]; patients: Patient[]; onDischarge: (id: string) => void }) {
  const active = patients.filter((p) => p.status === "treatment"); const queue = patients.filter((p) => p.status === "queue");
  const toneClass = category === "RED" ? "text-critical" : category === "YELLOW" ? "text-warning" : "text-success";
  return <section className="overflow-hidden rounded-lg border border-border bg-surface panel-shadow">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-strong/50 px-5 py-4"><div><p className={`text-[11px] font-bold tracking-[.2em] ${toneClass}`}>ACUITY {category}</p><h2 className="mt-1 text-xl font-bold">{category} care group</h2><p className="mt-1 text-xs text-muted-foreground">{category === "RED" ? "Immediate priority and highly experienced crews" : category === "YELLOW" ? "Urgent care, stage 4 before stage 3" : "Routine care, first come first served"}</p></div><div className="text-right"><strong className="text-2xl">{active.length}</strong><span className="ml-1 text-xs text-muted-foreground">in care</span></div></header>
    <div className="p-5"><Label>Active care</Label><div className="mt-3 grid gap-3 lg:grid-cols-2">{active.length ? active.map((p) => <PatientCard key={p.id} patient={p} onDischarge={onDischarge} />) : <Empty text="No patients in active care" />}</div><div className="mt-5"><Label>Queue</Label><div className="mt-3">{queue.length ? queue.map((p) => <PatientCard key={p.id} patient={p} onDischarge={onDischarge} queue />) : <Empty text="Queue is clear." />}</div></div></div>
  </section>;
}

function Label({ children }: { children: ReactNode }) { return <p className="text-[11px] font-bold uppercase tracking-[.22em] text-muted-foreground">{children}</p>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-20 place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">{text}</div>; }
function PatientCard({ patient, onDischarge, queue = false }: { patient: Patient; onDischarge: (id: string) => void; queue?: boolean }) { return <article className="rounded-md border border-border bg-card p-4"><div className="flex justify-between"><div><h3 className="font-bold">{patient.name}</h3><p className="text-xs text-muted-foreground">{patient.id} · {patient.age}y · {patient.room}</p></div><span className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-bold">L{patient.stage}</span></div><p className="mt-3 text-sm">{patient.note}</p><p className="mt-3 text-xs text-muted-foreground">♥ {patient.vitals}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full w-1/3 bg-primary" /></div><div className="mt-4 flex items-end justify-between gap-3"><p className="text-xs text-muted-foreground"><UsersRound className="mr-1 inline size-3" />{patient.team}</p>{!queue && <Button variant="ghost" size="sm" onClick={() => onDischarge(patient.id)}>Discharge</Button>}</div></article>; }

function Workforce() { return <section><Label>Workforce by tier</Label><div className="mt-3 space-y-3">{[{t:"ELE",n:"4/9",d:"Interns, doctors <5y, nurses <1y",w:"44%"},{t:"ME",n:"2/11",d:"Doctors 5–10y, nurses 3y+",w:"18%"},{t:"HE",n:"4/8",d:"Doctors 15y+, nurses 5y+",w:"50%"}].map((x) => <div key={x.t} className="rounded-lg border border-border bg-secondary/65 p-4"><div className="flex justify-between"><div><strong>{x.t}</strong><p className="mt-1 text-xs text-muted-foreground">{x.d}</p></div><strong className="text-2xl">{x.n}</strong></div><div className="mt-4 h-1.5 rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{width:x.w}} /></div><p className="mt-3 text-xs text-muted-foreground">Medical bag · available &nbsp; ⇄ 0 free-flow</p></div>)}</div><div className="mt-5"><Label>Crew on this floor</Label><ul className="mt-3 space-y-2 text-sm">{["Dr. Helen Voss — HE · engaged","Dr. Samuel Otieno — HE · free","Dr. Farah Idris — HE · engaged","Nurse Grace Miller — HE · engaged","Nurse Bea Santos — HE · free"].map((x) => <li key={x} className="border-b border-border pb-2">{x}</li>)}</ul></div></section>; }
function CapacityCard({ occupied, onNavigate }: { occupied: number; onNavigate: (s: Section) => void }) { return <button onClick={() => onNavigate("beds")} className="w-full rounded-lg border border-border bg-surface p-4 text-left panel-shadow"><div className="flex items-center justify-between"><div><Label>Physical capacity</Label><h3 className="mt-1 font-bold">Bed board</h3></div><strong className="text-2xl">{occupied}/22</strong></div><div className="mt-4 h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-clinical" style={{width:`${occupied/22*100}%`}} /></div></button>; }
function TrendCard() { return <section className="rounded-lg border border-border bg-surface p-4 panel-shadow"><Label>Utilization · 8 hours</Label><svg className="mt-3 h-28 w-full" viewBox="0 0 280 100" role="img" aria-label="Bed and staffing utilization trends"><path d="M0 78 C30 82 44 52 72 60 S118 45 145 52 S192 22 220 34 S258 18 280 20" fill="none" stroke="var(--clinical)" strokeWidth="3"/><path d="M0 65 C33 62 54 70 84 55 S135 62 164 45 S215 50 280 35" fill="none" stroke="var(--warning)" strokeWidth="3"/><line x1="0" y1="90" x2="280" y2="90" stroke="var(--border)"/><text x="0" y="100" fontSize="8" fill="var(--muted-foreground)">08:00</text><text x="250" y="100" fontSize="8" fill="var(--muted-foreground)">Now</text></svg><div className="flex gap-4 text-xs text-muted-foreground"><span>● Beds</span><span className="text-warning">● Staff load</span></div></section>; }
function Updates() { return <section className="rounded-lg border border-border bg-surface p-4 panel-shadow"><Label>Live updates</Label><div className="mt-3 space-y-4">{[["2m","R-02 oxygen support confirmed"],["6m","AMB-204 en route · KA-01-MD-4821"],["11m","Y-03 assigned to Dr. Otieno"]].map(([time,text]) => <div key={text} className="flex gap-3 text-sm"><span className="text-xs text-muted-foreground">{time}</span><span>{text}</span></div>)}</div></section>; }

function Intake({ result, setResult, onAdmit }: { result: (TriageResult & { id:string;name:string;age:number;gender:string;vitals:Vitals }) | null; setResult: React.Dispatch<React.SetStateAction<(TriageResult & { id:string;name:string;age:number;gender:string;vitals:Vitals }) | null>>; onAdmit: (p:Patient)=>void }) {
  const [step, setStep] = useState<"register"|"monitor"|"manual">("register"); const [loading,setLoading]=useState(false);
  const [identity,setIdentity]=useState({name:"",age:"",gender:""}); const [vitals,setVitals]=useState<Vitals>({systolic:120,diastolic:80,spo2:98,heartRate:76,respiration:16,pain:2,consciousness:"Alert"});
  const assess = () => { const age=Number(identity.age); if (!identity.name.trim() || age<0 || age>130 || !identity.gender) return; const triage=calculateTriage(vitals,age); const id=`PT-${Math.floor(100000+Math.random()*899999)}`; const full={...triage,id,name:identity.name.trim(),age,gender:identity.gender,vitals}; setResult(full); onAdmit({id,name:full.name,age,category:triage.category,stage:triage.stage,room:"Waiting",status:"queue",vitals:`${vitals.heartRate} bpm · SpO₂ ${vitals.spo2}% · ${vitals.systolic}/${vitals.diastolic}`,team:"Assignment pending",note:"New triage assessment"}); };
  const importVitals=()=>{setLoading(true);setTimeout(()=>{setVitals({systolic:165,diastolic:92,spo2:97,heartRate:58,respiration:25,pain:5,consciousness:"Alert"});setLoading(false);setStep("manual")},1400)};
  if(result) return <TriageOutput data={result} onReset={()=>{setResult(null);setStep("register")}} />;
  return <section className="mx-auto max-w-5xl"><PageTitle eyebrow="Main hospital management system" title="Register a patient" text="Save identity first, then connect the bedside monitor or enter observations manually." />
    <div className="mt-7 rounded-lg border border-border bg-surface p-5 panel-shadow sm:p-7">
      <div className="grid gap-4 md:grid-cols-[1fr_150px_210px]"><Field label="Patient name"><input value={identity.name} maxLength={100} onChange={e=>setIdentity({...identity,name:e.target.value})} placeholder="Full name" className="input" /></Field><Field label="Age"><input type="number" min="0" max="130" value={identity.age} onChange={e=>setIdentity({...identity,age:e.target.value})} placeholder="Age" className="input" /></Field><Field label="Gender (recorded)"><select className="input" value={identity.gender} onChange={e=>setIdentity({...identity,gender:e.target.value})}><option value="">Select gender</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Other</option></select></Field></div>
      <div className="mt-5 flex flex-wrap gap-3"><Button disabled={!identity.name||!identity.age||!identity.gender} onClick={()=>{setStep("monitor");importVitals()}}><Radio /> Add to HMS & connect monitor</Button><Button variant="outline" onClick={()=>setStep("manual")}><Import /> Automation unavailable? Add manually</Button></div>
      {step==="monitor" && loading && <div className="mt-8 grid min-h-56 place-items-center rounded-lg border border-border"><div className="text-center"><svg className="pulse-line mx-auto w-72 text-primary" viewBox="0 0 400 80"><path d="M0 42h135l15-30 17 58 20-28h213" fill="none" stroke="currentColor" strokeWidth="4" /></svg><p className="mt-3 font-medium">Waiting for bedside monitor feed…</p><p className="text-sm text-muted-foreground">Patient is registered. You can switch to manual entry if needed.</p></div></div>}
      {step==="manual" && <div className="mt-8"><div className="mb-5 flex items-center justify-between rounded-md border border-primary/20 bg-secondary p-4"><div><strong>Bedside monitor</strong><p className="text-xs text-muted-foreground">Vitals imported and ready to review</p></div><Button variant="outline" onClick={importVitals}><Import /> Import again</Button></div><VitalsForm vitals={vitals} setVitals={setVitals}/><Button className="mt-6" size="lg" onClick={assess}><Stethoscope /> Run assessment</Button></div>}
    </div>
  </section>;
}

function PageTitle({eyebrow,title,text}:{eyebrow:string;title:string;text:string}) { return <div><p className="text-xs font-bold uppercase tracking-[.22em] text-primary">{eyebrow}</p><h1 className="mt-2 text-3xl font-extrabold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>; }
function Field({label,children}:{label:string;children:ReactNode}) { return <label className="grid gap-2 text-sm font-semibold">{label}{children}</label>; }
function VitalsForm({vitals,setVitals}:{vitals:Vitals;setVitals:Dispatch<SetStateAction<Vitals>>}) { const number=(key:keyof Vitals,label:string,min:number,max:number)=><Field label={label}><input className="input" type="number" min={min} max={max} value={String(vitals[key])} onChange={e=>setVitals({...vitals,[key]:Number(e.target.value)})}/></Field>; return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{number("systolic","BP systolic (normal 90–140)",40,260)}{number("diastolic","BP diastolic (normal 60–90)",20,180)}{number("spo2","SpO₂ (normal ≥95%)",40,100)}{number("heartRate","Heart rate (normal 60–100)",20,240)}{number("respiration","Respiration rate (normal 12–20/min)",4,80)}{number("pain","Pain meter (0–10)",0,10)}<Field label="Consciousness"><select className="input" value={vitals.consciousness} onChange={e=>setVitals({...vitals,consciousness:e.target.value as Vitals["consciousness"]})}><option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option></select></Field></div>; }

function TriageOutput({data,onReset}:{data:TriageResult & {id:string;name:string;age:number;gender:string;vitals:Vitals};onReset:()=>void}) { const tone=data.category==="RED"?"border-critical/40 bg-critical-soft":data.category==="YELLOW"?"border-warning/40 bg-warning-soft":"border-success/40 bg-success-soft"; const numberTone=data.category==="RED"?"text-critical":data.category==="YELLOW"?"text-warning":"text-success"; const room=data.category==="RED"?"R-03":data.category==="YELLOW"?"Y-01":"G-03"; return <section className="mx-auto max-w-5xl space-y-5">
  <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-5"><div><p className="text-xs text-muted-foreground">Patient ID</p><strong className="font-mono text-lg">{data.id}</strong></div><Barcode code={data.id}/></div>
  <div className={`flex items-center justify-between rounded-lg border p-6 ${tone}`}><div className="flex items-center gap-5"><strong className={`font-display text-6xl ${numberTone}`}>{data.stage}</strong><div><h1 className="text-2xl font-bold">Stage {data.stage} — {data.category}</h1><p className="text-muted-foreground">{data.name} · age {data.age} · {data.gender}</p></div></div><div className="text-right"><span className="text-xs">Acuity score</span><strong className="block text-3xl">{data.score}</strong></div></div>
  <section className="rounded-lg border border-border bg-surface p-6"><h2 className="text-xl font-bold">Why this stage</h2><ul className="mt-4 space-y-2">{data.reasons.map((r,i)=><li key={i} className="grid grid-cols-[40px_1fr] text-sm"><strong className={r.points?"text-critical":"text-success"}>{r.points?`+${r.points}`:"0"}</strong><span>{r.text}</span></li>)}</ul></section>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><VitalCard label="Blood pressure" value={`${data.vitals.systolic}/${data.vitals.diastolic}`} normal="90–140 / 60–90"/><VitalCard label="SpO₂" value={`${data.vitals.spo2}%`} normal="≥ 95%"/><VitalCard label="Heart rate" value={`${data.vitals.heartRate} bpm`} normal="60–100 bpm"/><VitalCard label="Respiration" value={`${data.vitals.respiration}/min`} normal="12–20/min"/><VitalCard label="Age" value={String(data.age)} normal="Risk adjusted"/><VitalCard label="Pain" value={`${data.vitals.pain}/10`} normal="0–3"/><VitalCard label="Consciousness" value={data.vitals.consciousness} normal="Alert"/></div>
  <section><h2 className="text-xl font-bold">Care team assigned</h2><div className="mt-3 grid gap-3 md:grid-cols-3">{[["RB","DOCTOR","Dr. Ritu Bhatia","11 yrs experience"],["DK","NURSE","Divya Krishnan","7 yrs experience"],["KM","INTERN","Karan Malhotra","0.5 yrs experience"]].map(x=><div key={x[1]} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4"><span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground font-bold">{x[0]}</span><div><p className="text-[10px] font-bold text-primary">{x[1]}</p><strong>{x[2]}</strong><p className="text-xs text-muted-foreground">{x[3]}</p></div></div>)}</div></section>
  <section><h2 className="text-xl font-bold">Room</h2><div className="mt-3 inline-flex items-center gap-4 rounded-lg border border-success/40 bg-success-soft px-6 py-4"><BedDouble className="text-success"/><div><strong>{room}</strong><p className="text-xs text-muted-foreground">Vacant · ready for immediate transfer</p></div></div></section>
  <section><h2 className="text-xl font-bold">Before transfer</h2><div className="mt-3 grid gap-6 rounded-lg border border-border bg-surface p-6 md:grid-cols-2"><Checklist title="Before reporting / transfer" items={["Confirm room is sanitized and ready","Notify assigned nurse, intern and doctor","Establish IV access","Record transfer time in HMS"]}/><Checklist title="Equipment needed" items={["IV cannula and fluids","ECG monitor","Pulse oximeter","Emergency medication tray"]}/></div></section>
  <Button variant="outline" onClick={onReset}><X /> New assessment</Button>
  </section>; }
function Barcode({code}:{code:string}) { const bars=useMemo(()=>Array.from(code).flatMap((c,i)=>[...Array((c.charCodeAt(0)%3)+1)].map((_,j)=>({w:(c.charCodeAt(0)+j)%2?2:4,g:(i+j)%3+1}))),[code]); return <div className="hidden text-center sm:block"><div className="flex h-10 items-stretch gap-px">{bars.map((b,i)=><span key={i} className="bg-foreground" style={{width:b.w,marginRight:b.g}} />)}</div><span className="font-mono text-[9px]">{code}</span></div>; }
function VitalCard({label,value,normal}:{label:string;value:string;normal:string}) { return <div className="rounded-md border border-border border-l-4 border-l-clinical bg-surface p-4"><p className="text-xs text-muted-foreground">{label}</p><strong className="mt-1 block text-xl">{value}</strong><p className="mt-2 text-xs text-muted-foreground">Normal: {normal}</p></div>; }
function Checklist({title,items}:{title:string;items:string[]}) { return <div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">{title}</p><ul className="mt-3 space-y-2 text-sm">{items.map(x=><li key={x}>• {x}</li>)}</ul></div>; }

function BedBoard({patients}:{patients:Patient[]}) { const occupied=new Set(patients.filter(p=>p.room!=="Waiting").map(p=>p.room)); return <><PageTitle eyebrow="Physical capacity" title="Bed board" text="Every bed belongs to an acuity group. Discharge releases the room and its crew immediately."/><div className="mt-6 grid gap-5 lg:grid-cols-3">{(["GREEN","YELLOW","RED"] as const).map(cat=><section key={cat} className="rounded-lg border border-border bg-secondary/55 p-5"><div className="flex justify-between"><div><h2 className="text-xl font-bold">{cat} beds</h2><p className="text-xs text-muted-foreground">{cat==="GREEN"?"Routine / consult":cat==="YELLOW"?"Urgent / ward":"Critical / ICU"}</p></div><strong>{beds[cat].filter(b=>occupied.has(b)).length}/{beds[cat].length}</strong></div><div className="mt-5 grid grid-cols-3 gap-3">{beds[cat].map(b=><div key={b} className={`grid aspect-square place-items-center rounded-md border ${occupied.has(b)?"border-primary/30 bg-accent":"border-dashed border-border bg-surface"}`}><div className="text-center"><BedDouble className={`mx-auto size-5 ${occupied.has(b)?"text-primary":"text-muted-foreground"}`}/><strong className="mt-1 block text-xs">{b}</strong><span className={`text-[10px] ${occupied.has(b)?"text-primary":"text-success"}`}>{occupied.has(b)?"Occupied":"Vacant"}</span></div></div>)}</div></section>)}</div></>; }

function Records({patients}:{patients:Patient[]}) { const [q,setQ]=useState(""); const filtered=patients.filter(p=>(p.name+p.id).toLowerCase().includes(q.toLowerCase())); return <><PageTitle eyebrow="Hospital management system" title="Resource records" text="One register for active and historical patients, staff, beds, critical equipment, and ambulances."/><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[["Patients",patients.length,UsersRound],["Clinical staff",28,Stethoscope],["Beds",22,BedDouble],["Equipment",64,PackageCheck],["Ambulances",4,Ambulance]].map(([n,v,I])=>{const Icon=I as typeof Activity;return <div key={String(n)} className="rounded-lg border border-border bg-surface p-4 panel-shadow"><Icon className="size-5 text-primary"/><strong className="mt-4 block text-2xl">{String(v)}</strong><span className="text-xs text-muted-foreground">{String(n)} tracked</span></div>})}</div><div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]"><section className="overflow-hidden rounded-lg border border-border bg-surface"><div className="flex items-center gap-3 border-b border-border p-4"><Search className="size-4 text-muted-foreground"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search patient ID or name" className="w-full bg-transparent text-sm outline-none"/></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-secondary text-xs uppercase text-muted-foreground"><tr><th className="p-4">Patient</th><th className="p-4">Category</th><th className="p-4">Status</th><th className="p-4">Room</th></tr></thead><tbody>{filtered.map(p=><tr key={p.id} className="border-t border-border"><td className="p-4"><strong>{p.name}</strong><span className="block text-xs text-muted-foreground">{p.id}</span></td><td className="p-4">{p.category}</td><td className="p-4 capitalize">{p.status}</td><td className="p-4">{p.room}</td></tr>)}</tbody></table></div></section><section className="space-y-4"><div className="rounded-lg border border-border bg-surface p-5"><Label>Ambulance fleet</Label>{[["KA-01-MD-4821","En route · 7 min"],["KA-03-AB-1190","Available"],["KA-05-CN-7712","Available"],["KA-02-ZX-6044","Maintenance"]].map(x=><div key={x[0]} className="flex justify-between border-b border-border py-3 text-sm"><strong>{x[0]}</strong><span className="text-muted-foreground">{x[1]}</span></div>)}</div><div className="rounded-lg border border-primary/20 bg-secondary p-5"><Label>Predictive readiness</Label><h3 className="mt-2 font-bold">Yellow beds may tighten by 16:30</h3><p className="mt-2 text-sm text-muted-foreground">Based on intake velocity, prepare two ward rooms, reserve one ME nurse, and check oxygen stock.</p></div></section></div></>; }

function Analytics({blocking,onGridlock}:{blocking:number;onGridlock:()=>void}) { return <><PageTitle eyebrow="Operational intelligence" title="Resource utilisation dashboard" text="Live movement, computed utilisation, waiting pressure, and emerging shortages."/><div className="mt-6 grid gap-5 lg:grid-cols-3"><Chart title="Average waiting time" values={[8,9,12,11,14,18,16,21]} suffix=" min"/><DualChart/><MovementChart/></div><div className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]"><section className="rounded-lg border border-border bg-surface p-6"><Label>Live updates — arrivals, allocations and departures</Label><div className="mt-5 space-y-3">{["Victor Almeida placed in R-02 with Dr. Farah Idris and Nurse Grace Miller.","Noah Williams registered and assessed at level 3.","Ibrahim Yusuf placed in R-01 with Dr. Helen Voss and Nurse Yusuf Demir.","Leah Fontaine placed in G-02 with Dr. Arun Vaidya and Nurse Ivy Chen.","Ambulance KA-01-MD-4821 dispatched to East Gate."].map((x,i)=><div key={x} className="flex gap-4 rounded-md bg-secondary/65 p-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-primary"><Activity className="size-4"/></span><div><p className="text-sm">{x}</p><span className="text-xs text-muted-foreground">T-{i*3} min · live floor</span></div></div>)}</div></section><div className="space-y-5"><section className="rounded-lg border border-warning/30 bg-warning-soft p-6"><CircleAlert className="text-warning"/><h2 className="mt-4 text-xl font-bold">Gridlock watch</h2><p className="mt-2 text-4xl font-bold">{(blocking*100).toFixed(1)}%</p><p className="mt-2 text-sm text-muted-foreground">Erlang-B: B(14.8 offered load, 16 staffed beds)</p><Button className="mt-5" onClick={onGridlock}>Review escalation</Button></section><StaffAllocation/></div></div></>; }
function Chart({title,values}:{title:string;values:number[]}) { const pts=values.map((v,i)=>`${i*40},${100-v}`).join(" "); return <section className="rounded-lg border border-border bg-surface p-5 panel-shadow"><div className="flex justify-between"><h2 className="font-bold">{title}</h2><strong>{values.at(-1)}%</strong></div><svg className="mt-5 h-32 w-full" viewBox="0 0 280 110" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="3"/><line x1="0" y1="100" x2="280" y2="100" stroke="var(--border)" /></svg><p className="text-xs text-muted-foreground">08:00 — now</p></section>; }
