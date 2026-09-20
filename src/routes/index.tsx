import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Activity, Ambulance, ArrowRight, BedDouble, CircleAlert, HeartPulse,
  Import, LayoutDashboard, Menu, PackageCheck, Radio, Search, Stethoscope,
  UserRoundPlus, UsersRound, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calculateTriage, erlangB, type Gender, type TriageResult, type Vitals } from "@/lib/triage";
import {
  advanceFloor, bedById, bedInventory, capacity, findBed, readMonitor, sortQueue, staffById, staffRoster,
  type AllocationEvent, type Group, type Patient,
} from "@/lib/hospital";

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
type Outcome = TriageResult & { patient: Patient };

const seedVitals = (v: Partial<Vitals>): Vitals => ({ systolic: 120, diastolic: 80, spo2: 98, heartRate: 76, respiration: 16, pain: 2, consciousness: "Alert", ...v });

function seedPatient(name: string, age: number, gender: Gender, vitals: Vitals, minutesAgo: number, note: string): Patient {
  const triage = calculateTriage(vitals, age, gender);
  return {
    id: `PT-${Math.floor(100000 + Math.random() * 899999)}`,
    name, age, gender, category: triage.category, stage: triage.stage, score: triage.score,
    status: "queue", bedId: null, bedKind: null, borrowedBed: false,
    doctorId: null, nurseId: null, internId: null, nurseLed: false,
    arrivedAt: Date.now() - minutesAgo * 60000, startedAt: null, endsAt: null, completedAt: null,
    vitals, note, escalation: null, source: "monitor",
  };
}

const initialPatients: Patient[] = [
  seedPatient("Victor Almeida", 58, "Male", seedVitals({ systolic: 84, diastolic: 55, spo2: 84, heartRate: 138, respiration: 28, pain: 9, consciousness: "Pain" }), 22, "Immediate respiratory support"),
  seedPatient("Ibrahim Yusuf", 63, "Male", seedVitals({ systolic: 158, diastolic: 96, spo2: 90, heartRate: 122, respiration: 26, pain: 8, consciousness: "Voice" }), 18, "Bleeding, dressing required"),
  seedPatient("Maya Singh", 46, "Female", seedVitals({ systolic: 151, diastolic: 94, spo2: 92, heartRate: 118, respiration: 22, pain: 6 }), 15, "Persistent chest discomfort"),
  seedPatient("Noah Williams", 34, "Male", seedVitals({ systolic: 145, diastolic: 91, spo2: 95, heartRate: 108, respiration: 21, pain: 5 }), 12, "Observation requested"),
  seedPatient("Rhea Kapoor", 71, "Female", seedVitals({ systolic: 138, diastolic: 88, spo2: 94, heartRate: 96, respiration: 20, pain: 4 }), 9, "Dizziness after fall"),
  seedPatient("Leah Fontaine", 41, "Female", seedVitals({ systolic: 124, diastolic: 80, spo2: 96, heartRate: 104, respiration: 18, pain: 3 }), 7, "Mild breathlessness"),
  seedPatient("Aarav Sharma", 29, "Male", seedVitals({ heartRate: 72, spo2: 99, systolic: 118, diastolic: 76, pain: 1 }), 5, "Routine consultation"),
];

const nav: { id: Section; label: string; icon: typeof Activity }[] = [
  { id: "live", label: "Live floor", icon: LayoutDashboard }, { id: "intake", label: "Patient intake", icon: UserRoundPlus },
  { id: "beds", label: "Bed board", icon: BedDouble }, { id: "records", label: "Records", icon: PackageCheck },
  { id: "analytics", label: "Analytics", icon: Activity },
];

function Index() {
  const [section, setSection] = useState<Section>("live");
  const [mobileNav, setMobileNav] = useState(false);
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [feed, setFeed] = useState<(AllocationEvent & { at: number })[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [gridlockOpen, setGridlockOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const alerted = useRef(false);

  const pushEvents = (events: AllocationEvent[]) => {
    if (!events.length) return;
    const at = Date.now();
    setFeed((old) => [...events.map((e) => ({ ...e, at })), ...old].slice(0, 40));
  };

  // Live simulation: patients are pulled from the queue into care and released when treatment ends.
  useEffect(() => {
    const tick = () => {
      const stamp = Date.now();
      setNow(stamp);
      setPatients((current) => {
        const { patients: next, events } = advanceFloor(current, stamp);
        pushEvents(events);
        return next;
      });
    };
    tick();
    const timer = setInterval(tick, 3000);
    return () => clearInterval(timer);
  }, []);

  const live = patients.filter((p) => p.status !== "completed");
  const snapshot = useMemo(() => capacity(patients), [patients]);
  const offeredLoad = Math.max(2, live.length * 2.1);
  const blocking = erlangB(offeredLoad, snapshot.totalBeds - 6);

  useEffect(() => {
    if (blocking > 0.2 && !alerted.current) { alerted.current = true; setGridlockOpen(true); }
    if (blocking <= 0.15) alerted.current = false;
  }, [blocking]);

  const go = (next: Section) => { setSection(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const admit = (patient: Patient) => {
    const stamp = Date.now();
    const { patients: next, events } = advanceFloor([...patients, patient], stamp);
    setPatients(next);
    pushEvents([{ text: `${patient.name} registered in the main HMS as stage ${patient.stage} (${patient.category}).`, tone: "info" }, ...events]);
    return next.find((p) => p.id === patient.id) ?? patient;
  };

  const discharge = (id: string) => {
    setPatients((all) => all.map((p) => p.id === id ? { ...p, status: "completed", completedAt: Date.now(), bedId: null, bedKind: null, doctorId: null, nurseId: null, internId: null, escalation: null } : p));
    const patient = patients.find((p) => p.id === id);
    if (patient) pushEvents([{ text: `${patient.name} discharged manually; bed and crew released.`, tone: "success" }]);
  };

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
            <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="size-2 animate-pulse rounded-full bg-success" /> Live simulation</span>
            <Button onClick={() => go("intake")}><UserRoundPlus /> <span className="hidden sm:inline">Add patient</span></Button>
            <div className="hidden text-xs lg:block"><strong className="block">Avirath Bora</strong><span className="text-muted-foreground">Clinical admin</span></div>
          </div>
        </div>
        {mobileNav && <nav className="grid border-t border-border bg-surface p-2 md:hidden">{nav.map((item) => <button key={item.id} onClick={() => go(item.id)} className="flex items-center gap-3 px-3 py-3 text-sm"><item.icon className="size-4" />{item.label}</button>)}</nav>}
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:py-8">
        {section === "live" && <LiveFloor patients={live} snapshot={snapshot} feed={feed} now={now} onDischarge={discharge} onNavigate={go} onGridlock={() => setGridlockOpen(true)} blocking={blocking} offeredLoad={offeredLoad} />}
        {section === "intake" && <Intake outcome={outcome} setOutcome={setOutcome} onAdmit={admit} patients={patients} />}
        {section === "beds" && <BedBoard patients={live} />}
        {section === "records" && <Records patients={patients} snapshot={snapshot} />}
        {section === "analytics" && <Analytics blocking={blocking} onGridlock={() => setGridlockOpen(true)} feed={feed} patients={patients} />}
      </main>

      <Dialog open={gridlockOpen} onOpenChange={setGridlockOpen}>
        <DialogContent className="border-critical/30">
          <DialogHeader><div className="mb-2 grid size-11 place-items-center rounded-full bg-critical-soft text-critical"><CircleAlert /></div><DialogTitle>Capacity escalation required</DialogTitle><DialogDescription>Gridlock probability is {(blocking * 100).toFixed(1)}%, above the hospital’s 20% concern threshold.</DialogDescription></DialogHeader>
          <div className="rounded-md bg-critical-soft p-4 text-sm text-foreground"><strong>Recommended action:</strong> contact nearby hospitals for transfer availability, open overflow hall beds, and call in the reserve clinical team.</div>
          <Button onClick={() => setGridlockOpen(false)}>Acknowledge alert</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Snapshot = ReturnType<typeof capacity>;

function LiveFloor({ patients, snapshot, feed, now, onDischarge, onNavigate, onGridlock, blocking, offeredLoad }: { patients: Patient[]; snapshot: Snapshot; feed: (AllocationEvent & { at: number })[]; now: number; onDischarge: (id: string) => void; onNavigate: (s: Section) => void; onGridlock: () => void; blocking: number; offeredLoad: number }) {
  return <>
    <section className="clinical-shadow mb-6 grid gap-8 rounded-lg bg-primary p-7 text-primary-foreground lg:grid-cols-[1fr_auto] lg:items-end lg:p-9">
      <div><p className="mb-2 text-xs font-bold uppercase tracking-[.24em] text-primary-foreground/70">Live floor</p><h1 className="text-3xl font-extrabold">Calm control for every critical minute.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/80">{patients.length} patients are active across three acuity groups. Queues clear on their own as beds and crews free up, and every completed patient leaves the live floor for the main records.</p></div>
      <div className="grid grid-cols-3 gap-8"><Metric value={`${snapshot.totalBeds - snapshot.occupiedBeds}`} label="Beds free" /><Metric value={`${staffRoster.length - snapshot.busy.size}`} label="Crew free" /><Metric value={`${Math.round(blocking * 100)}%`} label="Gridlock risk" /></div>
    </section>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">{(["RED", "YELLOW", "GREEN"] as const).map((category) => <CareGroup key={category} category={category} patients={patients.filter((p) => p.category === category)} now={now} onDischarge={onDischarge} />)}</div>
      <aside className="space-y-5">
        <Availability snapshot={snapshot} />
        <Workforce snapshot={snapshot} />
        <CapacityCard snapshot={snapshot} onNavigate={onNavigate} />
        <TrendCard />
        <Updates feed={feed} />
        <div className="rounded-lg border border-warning/30 bg-warning-soft p-4"><p className="text-xs font-bold uppercase tracking-[.18em] text-warning">Erlang-B gridlock</p><button onClick={onGridlock} className="mt-2 text-left text-sm"><strong>B({offeredLoad.toFixed(1)} Erlangs, {snapshot.totalBeds - 6} staffed beds) = {(blocking * 100).toFixed(1)}%</strong> — review escalation <ArrowRight className="inline size-4" /></button></div>
      </aside>
    </div>
  </>;
}

function Metric({ value, label }: { value: string; label: string }) { return <div><strong className="block font-display text-3xl">{value}</strong><span className="text-[10px] uppercase text-primary-foreground/65">{label}</span></div>; }

function waitLabel(patient: Patient, now: number) { return `${Math.max(0, Math.round((now - patient.arrivedAt) / 60000))} min waiting`; }

function CareGroup({ category, patients, now, onDischarge }: { category: Group; patients: Patient[]; now: number; onDischarge: (id: string) => void }) {
  const active = patients.filter((p) => p.status === "treatment");
  const queue = sortQueue(patients.filter((p) => p.status === "queue"), now);
  const toneClass = category === "RED" ? "text-critical" : category === "YELLOW" ? "text-warning" : "text-success";
  return <section className="overflow-hidden rounded-lg border border-border bg-surface panel-shadow">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-strong/50 px-5 py-4"><div><p className={`text-[11px] font-bold tracking-[.2em] ${toneClass}`}>ACUITY {category}</p><h2 className="mt-1 text-xl font-bold">{category} care group</h2><p className="mt-1 text-xs text-muted-foreground">{category === "RED" ? "Stage 5 — most experienced crews, chronological order" : category === "YELLOW" ? "Stage 3 & 4 — stage 4 first, stage 3 promoted after 8 minutes waiting" : "Stage 1 & 2 — first come, first served"}</p></div><div className="text-right"><strong className="text-2xl">{active.length}</strong><span className="ml-1 text-xs text-muted-foreground">in care</span><span className="block text-xs text-muted-foreground">{queue.length} queued</span></div></header>
    <div className="p-5">
      <Label>Active care track</Label>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">{active.length ? active.map((p) => <PatientCard key={p.id} patient={p} now={now} onDischarge={onDischarge} />) : <Empty text="No patients in active care" />}</div>
      <div className="mt-5"><Label>Queue</Label><div className="mt-3 space-y-3">{queue.length ? queue.map((p, i) => <PatientCard key={p.id} patient={p} now={now} onDischarge={onDischarge} queue position={i + 1} />) : <Empty text="Queue is clear." />}</div></div>
    </div>
  </section>;
}

function Label({ children }: { children: ReactNode }) { return <p className="text-[11px] font-bold uppercase tracking-[.22em] text-muted-foreground">{children}</p>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-20 place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">{text}</div>; }

function PatientCard({ patient, now, onDischarge, queue = false, position }: { patient: Patient; now: number; onDischarge: (id: string) => void; queue?: boolean; position?: number }) {
  const doctor = staffById(patient.doctorId);
  const nurse = staffById(patient.nurseId);
  const intern = staffById(patient.internId);
  const progress = patient.startedAt && patient.endsAt ? Math.min(100, ((now - patient.startedAt) / (patient.endsAt - patient.startedAt)) * 100) : 0;
  const bed = bedById(patient.bedId);
  return <article className="rounded-md border border-border bg-card p-4">
    <div className="flex justify-between gap-3">
      <div><h3 className="font-bold">{patient.name}</h3><p className="text-xs text-muted-foreground">{patient.id} · {patient.age}y · {patient.gender} · {bed ? `${bed.id} (${bed.kind})` : queue ? `#${position} in queue` : "Awaiting bed"}</p></div>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">L{patient.stage}</span>
    </div>
    <p className="mt-3 text-sm">{patient.note}</p>
    <p className="mt-2 text-xs text-muted-foreground">♥ {patient.vitals.heartRate} bpm · SpO₂ {patient.vitals.spo2}% · {patient.vitals.systolic}/{patient.vitals.diastolic} · {waitLabel(patient, now)}</p>
    {patient.escalation && <p className="mt-3 rounded-md bg-warning-soft p-2 text-xs text-warning">{patient.escalation}</p>}
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${queue ? 0 : progress}%` }} /></div>
    <div className="mt-4 flex items-end justify-between gap-3">
      <p className="text-xs text-muted-foreground"><UsersRound className="mr-1 inline size-3" />{queue ? "Assignment pending" : [doctor?.name, nurse?.name, intern?.name].filter(Boolean).join(" · ")}</p>
      {!queue && <Button variant="ghost" size="sm" onClick={() => onDischarge(patient.id)}>Discharge</Button>}
    </div>
  </article>;
}

function Availability({ snapshot }: { snapshot: Snapshot }) {
  return <section className="rounded-lg border border-border bg-surface p-4 panel-shadow">
    <Label>Availability by group</Label>
    <div className="mt-3 space-y-3">{snapshot.perGroup.map((g) => <div key={g.group} className="rounded-md border border-border bg-secondary/55 p-3 text-xs">
      <div className="flex items-center justify-between"><strong className={g.group === "RED" ? "text-critical" : g.group === "YELLOW" ? "text-warning" : "text-success"}>{g.group}</strong><span>{g.free}/{g.beds} beds free</span></div>
      <p className="mt-2 text-muted-foreground">Rooms {g.roomsFree}/{g.rooms}{g.halls ? ` · Hall beds ${g.hallsFree}/${g.halls}` : ""}</p>
      <p className="text-muted-foreground">Doctors {g.doctorsFree}/{g.doctors} free · Nurses {g.nursesFree}/{g.nurses} free</p>
    </div>)}</div>
  </section>;
}

function Workforce({ snapshot }: { snapshot: Snapshot }) {
  const tiers = (["ELE", "ME", "HE"] as const).map((tier) => {
    const list = staffRoster.filter((s) => s.tier === tier);
    const free = list.filter((s) => !snapshot.busy.has(s.id));
    return { tier, free: free.length, total: list.length, description: tier === "ELE" ? "Interns, doctors <5y, nurses <2y" : tier === "ME" ? "Doctors 5–10y, nurses 3y+" : "Doctors 15y+, nurses 5y+" };
  });
  return <section><Label>Workforce by tier</Label>
    <div className="mt-3 space-y-3">{tiers.map((x) => <div key={x.tier} className="rounded-lg border border-border bg-secondary/65 p-4"><div className="flex justify-between"><div><strong>{x.tier}</strong><p className="mt-1 text-xs text-muted-foreground">{x.description}</p></div><strong className="text-2xl">{x.free}/{x.total}</strong></div><div className="mt-4 h-1.5 rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{ width: `${(x.free / x.total) * 100}%` }} /></div><p className="mt-3 text-xs text-muted-foreground">Free-flow enabled across groups</p></div>)}</div>
    <div className="mt-5"><Label>Crew on this floor</Label><ul className="mt-3 space-y-2 text-sm">{staffRoster.filter((s) => s.role !== "Intern").slice(0, 8).map((s) => <li key={s.id} className="flex justify-between border-b border-border pb-2"><span>{s.name}</span><span className={snapshot.busy.has(s.id) ? "text-xs text-muted-foreground" : "text-xs text-success"}>{s.tier} · {snapshot.busy.has(s.id) ? "engaged" : "free"}</span></li>)}</ul></div>
  </section>;
}

function CapacityCard({ snapshot, onNavigate }: { snapshot: Snapshot; onNavigate: (s: Section) => void }) { return <button onClick={() => onNavigate("beds")} className="w-full rounded-lg border border-border bg-surface p-4 text-left panel-shadow"><div className="flex items-center justify-between"><div><Label>Physical capacity</Label><h3 className="mt-1 font-bold">Bed board</h3></div><strong className="text-2xl">{snapshot.occupiedBeds}/{snapshot.totalBeds}</strong></div><div className="mt-4 h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-clinical" style={{ width: `${snapshot.occupiedBeds / snapshot.totalBeds * 100}%` }} /></div></button>; }
function TrendCard() { return <section className="rounded-lg border border-border bg-surface p-4 panel-shadow"><Label>Utilization · 8 hours</Label><svg className="mt-3 h-28 w-full" viewBox="0 0 280 100" role="img" aria-label="Bed and staffing utilization trends"><path d="M0 78 C30 82 44 52 72 60 S118 45 145 52 S192 22 220 34 S258 18 280 20" fill="none" stroke="var(--clinical)" strokeWidth="3"/><path d="M0 65 C33 62 54 70 84 55 S135 62 164 45 S215 50 280 35" fill="none" stroke="var(--warning)" strokeWidth="3"/><line x1="0" y1="90" x2="280" y2="90" stroke="var(--border)"/><text x="0" y="100" fontSize="8" fill="var(--muted-foreground)">08:00</text><text x="250" y="100" fontSize="8" fill="var(--muted-foreground)">Now</text></svg><div className="flex gap-4 text-xs text-muted-foreground"><span>● Beds</span><span className="text-warning">● Staff load</span></div></section>; }

function Updates({ feed }: { feed: (AllocationEvent & { at: number })[] }) {
  return <section className="rounded-lg border border-border bg-surface p-4 panel-shadow"><Label>Live updates</Label><div className="mt-3 space-y-3">{feed.length ? feed.slice(0, 6).map((e, i) => <div key={`${e.at}-${i}`} className="flex gap-3 text-sm"><span className={`mt-1 size-2 shrink-0 rounded-full ${e.tone === "critical" ? "bg-critical" : e.tone === "warning" ? "bg-warning" : e.tone === "success" ? "bg-success" : "bg-primary"}`} /><span>{e.text}</span></div>) : <p className="text-sm text-muted-foreground">Waiting for floor activity…</p>}</div></section>;
}

function Intake({ outcome, setOutcome, onAdmit, patients }: { outcome: Outcome | null; setOutcome: Dispatch<SetStateAction<Outcome | null>>; onAdmit: (p: Patient) => Patient; patients: Patient[] }) {
  const [step, setStep] = useState<"register" | "monitor" | "review">("register");
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"monitor" | "manual">("monitor");
  const [identity, setIdentity] = useState<{ name: string; age: string; gender: Gender | "" }>({ name: "", age: "", gender: "" });
  const [vitals, setVitals] = useState<Vitals>(seedVitals({}));

  const importVitals = () => {
    setLoading(true);
    setSource("monitor");
    setTimeout(() => { setVitals(readMonitor((identity.gender || "Other") as Gender, Number(identity.age) || 40)); setLoading(false); setStep("review"); }, 1400);
  };

  const assess = () => {
    const age = Number(identity.age);
    if (!identity.name.trim() || !identity.gender || age < 0 || age > 130) return;
    const gender = identity.gender as Gender;
    const triage = calculateTriage(vitals, age, gender);
    const patient: Patient = {
      id: `PT-${Math.floor(100000 + Math.random() * 899999)}`,
      name: identity.name.trim(), age, gender, category: triage.category, stage: triage.stage, score: triage.score,
      status: "queue", bedId: null, bedKind: null, borrowedBed: false,
      doctorId: null, nurseId: null, internId: null, nurseLed: false,
      arrivedAt: Date.now(), startedAt: null, endsAt: null, completedAt: null,
      vitals, note: source === "monitor" ? "Vitals imported from bedside monitor" : "Vitals entered manually (automation offline)", escalation: null, source,
    };
    setOutcome({ ...triage, patient: onAdmit(patient) });
  };

  const reset = () => { setOutcome(null); setStep("register"); setIdentity({ name: "", age: "", gender: "" }); setVitals(seedVitals({})); setSource("monitor"); };

  if (outcome) return <TriageOutput outcome={outcome} patients={patients} onReset={reset} />;

  return <section className="mx-auto max-w-5xl"><PageTitle eyebrow="Main hospital management system" title="Register a patient" text="Name, age and gender are entered by staff; everything else arrives from the bedside monitor, with manual entry as a fallback." />
    <div className="mt-7 rounded-lg border border-border bg-surface p-5 panel-shadow sm:p-7">
      <div className="grid gap-4 md:grid-cols-[1fr_150px_210px]">
        <Field label="Patient name"><input value={identity.name} maxLength={100} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} placeholder="Full name" className="input" /></Field>
        <Field label="Age"><input type="number" min="0" max="130" value={identity.age} onChange={(e) => setIdentity({ ...identity, age: e.target.value })} placeholder="Age" className="input" /></Field>
        <Field label="Gender (affects vital ranges)"><select className="input" value={identity.gender} onChange={(e) => setIdentity({ ...identity, gender: e.target.value as Gender })}><option value="">Select gender</option><option>Female</option><option>Male</option><option>Other</option></select></Field>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button disabled={!identity.name || !identity.age || !identity.gender} onClick={() => { setStep("monitor"); importVitals(); }}><Radio /> Add to HMS & import vitals</Button>
        <Button variant="outline" disabled={!identity.name || !identity.age || !identity.gender} onClick={() => { setSource("manual"); setStep("review"); }}><Import /> Automation down? Enter manually</Button>
      </div>
      {step === "monitor" && loading && <div className="mt-8 grid min-h-56 place-items-center rounded-lg border border-border"><div className="text-center"><svg className="pulse-line mx-auto w-72 text-primary" viewBox="0 0 400 80"><path d="M0 42h135l15-30 17 58 20-28h213" fill="none" stroke="currentColor" strokeWidth="4" /></svg><p className="mt-3 font-medium">Reading the bedside monitor…</p><p className="text-sm text-muted-foreground">Patient is already saved in the main HMS. Switch to manual entry if the link drops.</p></div></div>}
      {step === "review" && !loading && <div className="mt-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/20 bg-secondary p-4"><div><strong>{source === "monitor" ? "Bedside monitor" : "Manual entry"}</strong><p className="text-xs text-muted-foreground">{source === "monitor" ? "Vitals imported automatically — review before assessment" : "Automation bypassed — enter the observations recorded at the bedside"}</p></div><Button variant="outline" onClick={importVitals}><Import /> Import from monitor</Button></div>
        <VitalsForm vitals={vitals} setVitals={setVitals} />
        <Button className="mt-6" size="lg" onClick={assess}><Stethoscope /> Run assessment & allocate</Button>
      </div>}
    </div>
  </section>;
}

function PageTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <div><p className="text-xs font-bold uppercase tracking-[.22em] text-primary">{eyebrow}</p><h1 className="mt-2 text-3xl font-extrabold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-2 text-sm font-semibold">{label}{children}</label>; }
function VitalsForm({ vitals, setVitals }: { vitals: Vitals; setVitals: Dispatch<SetStateAction<Vitals>> }) { const number = (key: keyof Vitals, label: string, min: number, max: number) => <Field label={label}><input className="input" type="number" min={min} max={max} value={String(vitals[key])} onChange={(e) => setVitals({ ...vitals, [key]: Number(e.target.value) })} /></Field>; return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{number("systolic", "BP systolic", 40, 260)}{number("diastolic", "BP diastolic", 20, 180)}{number("spo2", "SpO₂ (%)", 40, 100)}{number("heartRate", "Heart rate (bpm)", 20, 240)}{number("respiration", "Respiration (per min)", 4, 80)}{number("pain", "Pain meter (0–10)", 0, 10)}<Field label="Consciousness"><select className="input" value={vitals.consciousness} onChange={(e) => setVitals({ ...vitals, consciousness: e.target.value as Vitals["consciousness"] })}><option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option></select></Field></div>; }

function TriageOutput({ outcome, patients, onReset }: { outcome: Outcome; patients: Patient[]; onReset: () => void }) {
  const data = outcome;
  const live = patients.find((p) => p.id === data.patient.id) ?? data.patient;
  const tone = data.category === "RED" ? "border-critical/40 bg-critical-soft" : data.category === "YELLOW" ? "border-warning/40 bg-warning-soft" : "border-success/40 bg-success-soft";
  const numberTone = data.category === "RED" ? "text-critical" : data.category === "YELLOW" ? "text-warning" : "text-success";
  const doctor = staffById(live.doctorId);
  const nurse = staffById(live.nurseId);
  const intern = staffById(live.internId);
  const snapshot = capacity(patients);
  const projected = live.bedId ? bedById(live.bedId) : findBed(snapshot.occupied, live.category, live.stage)?.bed ?? null;
  const team: [string, string, string, string][] = [
    doctor ? [doctor.name.split(" ").slice(-1)[0]!.slice(0, 2).toUpperCase(), "DOCTOR", doctor.name, `${doctor.years} yrs · ${doctor.tier}`] : ["--", "DOCTOR", "Nurse-led until a doctor frees up", "Escalation logged"],
    nurse ? [nurse.name.split(" ").slice(-1)[0]!.slice(0, 2).toUpperCase(), "NURSE", nurse.name, `${nurse.years} yrs · ${nurse.tier}`] : ["--", "NURSE", "Pending", "Awaiting allocation"],
    intern ? [intern.name.split(" ").slice(-1)[0]!.slice(0, 2).toUpperCase(), "INTERN", intern.name, `${intern.years} yrs · supervised`] : ["--", "INTERN", data.category === "RED" ? "Not assigned in RED" : "Pending", data.category === "RED" ? "Critical care crew only" : "Awaiting allocation"],
  ];
  return <section className="mx-auto max-w-5xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5"><div><p className="text-xs text-muted-foreground">Patient ID</p><strong className="font-mono text-lg">{live.id}</strong><p className="text-xs text-muted-foreground">Saved to the main HMS · {live.source === "monitor" ? "monitor feed" : "manual entry"}</p></div><Barcode code={live.id} /></div>
    <div className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border p-6 ${tone}`}><div className="flex items-center gap-5"><strong className={`font-display text-6xl ${numberTone}`}>{data.stage}</strong><div><h1 className="text-2xl font-bold">Stage {data.stage} — {data.category}</h1><p className="text-muted-foreground">{live.name} · age {live.age} · {live.gender}</p></div></div><div className="text-right"><span className="text-xs">Acuity score</span><strong className="block text-3xl">{data.score}</strong></div></div>
    <section className="rounded-lg border border-border bg-surface p-6"><h2 className="text-xl font-bold">Why this stage</h2><ul className="mt-4 space-y-2">{data.reasons.map((r, i) => <li key={i} className="grid grid-cols-[40px_1fr] text-sm"><strong className={r.points ? "text-critical" : "text-success"}>{r.points ? `+${r.points}` : "0"}</strong><span>{r.text}</span></li>)}</ul></section>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><VitalCard label="Blood pressure" value={`${live.vitals.systolic}/${live.vitals.diastolic}`} normal="90–140 / 60–90" /><VitalCard label="SpO₂" value={`${live.vitals.spo2}%`} normal="≥ 95%" /><VitalCard label="Heart rate" value={`${live.vitals.heartRate} bpm`} normal="60–100 bpm" /><VitalCard label="Respiration" value={`${live.vitals.respiration}/min`} normal="12–20/min" /><VitalCard label="Age" value={String(live.age)} normal="Risk adjusted" /><VitalCard label="Pain" value={`${live.vitals.pain}/10`} normal="0–3" /><VitalCard label="Consciousness" value={live.vitals.consciousness} normal="Alert" /></div>
    <section><h2 className="text-xl font-bold">Care team assigned</h2><div className="mt-3 grid gap-3 md:grid-cols-3">{team.map((x) => <div key={x[1]} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-foreground">{x[0]}</span><div><p className="text-[10px] font-bold text-primary">{x[1]}</p><strong>{x[2]}</strong><p className="text-xs text-muted-foreground">{x[3]}</p></div></div>)}</div></section>
    <section><h2 className="text-xl font-bold">Room</h2><div className="mt-3 inline-flex items-center gap-4 rounded-lg border border-success/40 bg-success-soft px-6 py-4"><BedDouble className="text-success" /><div><strong>{projected ? projected.id : "No bed free"}</strong><p className="text-xs text-muted-foreground">{projected ? `${projected.group} group · ${projected.kind === "hall" ? "hall bed (shared ward)" : "private room"} · ${live.bedId ? "occupied now" : "held for transfer"}` : "Enquire with nearby hospitals for transfer"}</p></div></div>{live.escalation && <p className="mt-3 rounded-md bg-warning-soft p-3 text-sm text-warning">{live.escalation}</p>}</section>
    <section><h2 className="text-xl font-bold">Before transfer</h2><div className="mt-3 grid gap-6 rounded-lg border border-border bg-surface p-6 md:grid-cols-2"><Checklist title="Before reporting / transfer" items={["Confirm room is sanitized and ready", "Notify assigned nurse, intern and doctor", "Establish IV access", "Record transfer time in HMS"]} /><Checklist title="Equipment needed" items={["IV cannula and fluids", "ECG monitor", "Pulse oximeter", "Emergency medication tray"]} /></div></section>
    <Button variant="outline" onClick={onReset}><X /> Add the next patient</Button>
  </section>;
}

function Barcode({ code }: { code: string }) { const bars = useMemo(() => Array.from(code).flatMap((c, i) => [...Array((c.charCodeAt(0) % 3) + 1)].map((_, j) => ({ w: (c.charCodeAt(0) + j) % 2 ? 2 : 4, g: (i + j) % 3 + 1 }))), [code]); return <div className="hidden text-center sm:block"><div className="flex h-10 items-stretch gap-px">{bars.map((b, i) => <span key={i} className="bg-foreground" style={{ width: b.w, marginRight: b.g }} />)}</div><span className="font-mono text-[9px]">{code}</span></div>; }
function VitalCard({ label, value, normal }: { label: string; value: string; normal: string }) { return <div className="rounded-md border border-border border-l-4 border-l-clinical bg-surface p-4"><p className="text-xs text-muted-foreground">{label}</p><strong className="mt-1 block text-xl">{value}</strong><p className="mt-2 text-xs text-muted-foreground">Normal: {normal}</p></div>; }
function Checklist({ title, items }: { title: string; items: string[] }) { return <div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">{title}</p><ul className="mt-3 space-y-2 text-sm">{items.map((x) => <li key={x}>• {x}</li>)}</ul></div>; }

function BedBoard({ patients }: { patients: Patient[] }) {
  const occupied = new Map(patients.filter((p) => p.bedId).map((p) => [p.bedId as string, p]));
  return <><PageTitle eyebrow="Physical capacity" title="Bed board" text="Yellow carries the largest bed pool because its hall holds many beds; every bed can flow to another group in an emergency." />
    <div className="mt-6 grid gap-5 lg:grid-cols-3">{(["GREEN", "YELLOW", "RED"] as const).map((cat) => {
      const groupBeds = bedInventory.filter((b) => b.group === cat);
      return <section key={cat} className="rounded-lg border border-border bg-secondary/55 p-5">
        <div className="flex justify-between"><div><h2 className="text-xl font-bold">{cat} beds</h2><p className="text-xs text-muted-foreground">{cat === "GREEN" ? "Routine / consult rooms" : cat === "YELLOW" ? "Shared hall + rooms when needed" : "Critical / ICU rooms"}</p></div><strong>{groupBeds.filter((b) => occupied.has(b.id)).length}/{groupBeds.length}</strong></div>
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">{groupBeds.map((b) => { const taken = occupied.get(b.id); return <div key={b.id} className={`grid aspect-square place-items-center rounded-md border p-1 ${taken ? "border-primary/30 bg-accent" : "border-dashed border-border bg-surface"}`}><div className="text-center"><BedDouble className={`mx-auto size-4 ${taken ? "text-primary" : "text-muted-foreground"}`} /><strong className="mt-1 block text-[11px]">{b.id}</strong><span className="block text-[9px] text-muted-foreground">{b.kind}</span><span className={`text-[9px] ${taken ? "text-primary" : "text-success"}`}>{taken ? "Occupied" : "Vacant"}</span></div></div>; })}</div>
      </section>;
    })}</div></>;
}

const equipment = [
  ["Ventilators", "RTLS · ICU wing", 6, 4], ["Infusion pumps", "RTLS · all floors", 24, 18],
  ["ECG monitors", "RTLS · triage bays", 14, 9], ["Oxygen cylinders", "Inventory module", 40, 26],
  ["Wheelchairs", "RTLS · lobby", 18, 11], ["Emergency drug trays", "Inventory module", 22, 15],
];

const ambulances = [["KA-01-MD-4821", "En route · 7 min"], ["KA-03-AB-1190", "Available"], ["KA-05-CN-7712", "Available"], ["KA-02-ZX-6044", "Maintenance"], ["KA-07-PQ-3358", "Returning · 12 min"]];

function Records({ patients, snapshot }: { patients: Patient[]; snapshot: Snapshot }) {
  const [tab, setTab] = useState<"live" | "hms" | "equipment" | "ai">("live");
  const [q, setQ] = useState("");
  const match = (p: Patient) => (p.name + p.id).toLowerCase().includes(q.toLowerCase());
  const liveRows = patients.filter((p) => p.status !== "completed" && match(p));
  const hmsRows = patients.filter(match);
  const tabs = [["live", "Live records"], ["hms", "Main HMS records"], ["equipment", "Equipment & resources"], ["ai", "AI arrangements"]] as const;

  return <><PageTitle eyebrow="Hospital management system" title="Record management" text="Live records hold only queued and in-treatment patients; completed patients stay in the main HMS with equipment, fleet and AI planning." />
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{([["Patients in HMS", patients.length, UsersRound], ["On live floor", patients.filter((p) => p.status !== "completed").length, Activity], ["Beds", snapshot.totalBeds, BedDouble], ["Equipment lines", equipment.length, PackageCheck], ["Ambulances", ambulances.length, Ambulance]] as const).map(([n, v, I]) => { const Icon = I as typeof Activity; return <div key={n} className="rounded-lg border border-border bg-surface p-4 panel-shadow"><Icon className="size-5 text-primary" /><strong className="mt-4 block text-2xl">{v}</strong><span className="text-xs text-muted-foreground">{n}</span></div>; })}</div>

    <div className="mt-6 flex flex-wrap gap-2 border-b border-border">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`px-4 py-3 text-sm font-semibold ${tab === id ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>{label}</button>)}</div>

    {(tab === "live" || tab === "hms") && <section className="mt-5 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border p-4"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient ID or name" className="w-full bg-transparent text-sm outline-none" /></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-secondary text-xs uppercase text-muted-foreground"><tr><th className="p-4">Patient</th><th className="p-4">Gender</th><th className="p-4">Category</th><th className="p-4">Assignment</th><th className="p-4">Status</th></tr></thead>
        <tbody>{(tab === "live" ? liveRows : hmsRows).map((p) => <tr key={p.id} className="border-t border-border"><td className="p-4"><strong>{p.name}</strong><span className="block text-xs text-muted-foreground">{p.id} · {p.age}y</span></td><td className="p-4">{p.gender}</td><td className="p-4">{p.category} · L{p.stage}</td><td className="p-4">{p.bedId ? `${p.bedId} · ${staffById(p.doctorId)?.name ?? staffById(p.nurseId)?.name ?? "crew pending"}` : "—"}</td><td className="p-4 capitalize">{p.status === "completed" ? "Completed" : p.status}</td></tr>)}
        {!(tab === "live" ? liveRows : hmsRows).length && <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">No records match.</td></tr>}</tbody></table></div>
    </section>}

    {tab === "equipment" && <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="overflow-hidden rounded-lg border border-border bg-surface"><table className="w-full text-left text-sm"><thead className="bg-secondary text-xs uppercase text-muted-foreground"><tr><th className="p-4">Resource</th><th className="p-4">Tracking</th><th className="p-4">Available</th></tr></thead><tbody>{equipment.map(([name, track, total, free]) => <tr key={String(name)} className="border-t border-border"><td className="p-4"><strong>{name}</strong></td><td className="p-4 text-muted-foreground">{track}</td><td className="p-4">{free}/{total}</td></tr>)}</tbody></table></section>
      <section className="rounded-lg border border-border bg-surface p-5"><Label>Ambulance fleet</Label>{ambulances.map(([plate, status]) => <div key={plate} className="flex justify-between border-b border-border py-3 text-sm"><strong>{plate}</strong><span className="text-muted-foreground">{status}</span></div>)}</section>
    </div>}

    {tab === "ai" && <div className="mt-5 grid gap-5 lg:grid-cols-2">{[
      ["Yellow hall beds tighten by 16:30", `Intake velocity suggests ${Math.max(2, snapshot.perGroup[1]!.free - 2)} hall beds left in two hours. Two rooms are being prepared and one ME nurse held back.`],
      ["Oxygen cylinders below comfort level", "26 of 40 cylinders available with rising red demand. A replenishment order was raised with central stores."],
      ["HE crew fatigue risk", "Red group has run at high load for 3 hours. One HE doctor is being rotated in from yellow free-flow."],
      ["Ambulance coverage", "Two units available and one in maintenance. KA-07-PQ-3358 is recalled early to keep two units on standby."],
    ].map(([title, text]) => <section key={title} className="rounded-lg border border-primary/20 bg-secondary p-5"><Label>Predictive arrangement</Label><h3 className="mt-2 font-bold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></section>)}</div>}
  </>;
}

function Analytics({ blocking, onGridlock, feed, patients }: { blocking: number; onGridlock: () => void; feed: (AllocationEvent & { at: number })[]; patients: Patient[] }) {
  const completed = patients.filter((p) => p.status === "completed").length;
  const snapshot = capacity(patients);
  return <><PageTitle eyebrow="Operational intelligence" title="Resource utilisation dashboard" text="Live movement, computed utilisation, waiting pressure, and emerging shortages." />
    <div className="mt-6 grid gap-5 lg:grid-cols-3"><Chart title="Average waiting time" values={[8, 9, 12, 11, 14, 18, 16, 21]} suffix=" min" /><DualChart /><MovementChart patients={patients} /></div>
    <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
      <section className="rounded-lg border border-border bg-surface p-6"><Label>Live updates — arrivals, allocations and departures</Label><div className="mt-5 space-y-3">{feed.slice(0, 8).map((e, i) => <div key={`${e.at}-${i}`} className="flex gap-4 rounded-md bg-secondary/65 p-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-primary"><Activity className="size-4" /></span><div><p className="text-sm">{e.text}</p><span className="text-xs text-muted-foreground">{new Date(e.at).toLocaleTimeString()} · live floor</span></div></div>)}{!feed.length && <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}</div></section>
      <div className="space-y-5">
        <section className="rounded-lg border border-warning/30 bg-warning-soft p-6"><CircleAlert className="text-warning" /><h2 className="mt-4 text-xl font-bold">Gridlock watch</h2><p className="mt-2 text-4xl font-bold">{(blocking * 100).toFixed(1)}%</p><p className="mt-2 text-sm text-muted-foreground">Erlang-B on staffed beds · {completed} patients cleared so far</p><Button className="mt-5" onClick={onGridlock}>Review escalation</Button></section>
        <StaffAllocation snapshot={snapshot} />
      </div>
    </div>
  </>;
}

function Chart({ title, values, suffix = "%" }: { title: string; values: number[]; suffix?: string }) { const pts = values.map((v, i) => `${i * 40},${100 - v}`).join(" "); return <section className="rounded-lg border border-border bg-surface p-5 panel-shadow"><div className="flex justify-between"><h2 className="font-bold">{title}</h2><strong>{values.at(-1)}{suffix}</strong></div><svg className="mt-5 h-32 w-full" viewBox="0 0 280 110" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="3" /><line x1="0" y1="100" x2="280" y2="100" stroke="var(--border)" /></svg><p className="text-xs text-muted-foreground">08:00 — now</p></section>; }
function DualChart() { return <section className="rounded-lg border border-border bg-surface p-5 panel-shadow"><div className="flex justify-between"><h2 className="font-bold">Treated & emergency</h2><strong>18 total</strong></div><svg className="mt-5 h-32 w-full" viewBox="0 0 280 110" preserveAspectRatio="none"><polyline points="0,84 40,64 80,55 120,50 160,39 200,31 240,25 280,20" fill="none" stroke="var(--success)" strokeWidth="3" /><polyline points="0,92 40,84 80,81 120,76 160,68 200,60 240,57 280,52" fill="none" stroke="var(--critical)" strokeWidth="3" /><line x1="0" y1="100" x2="280" y2="100" stroke="var(--border)" /></svg><div className="flex gap-4 text-xs"><span className="text-success">● Treated 12</span><span className="text-critical">● Emergency 6</span></div></section>; }

function MovementChart({ patients }: { patients: Patient[] }) {
  const stageCount = (stage: number) => patients.filter((p) => p.stage === stage).length;
  const rows: [string, number, string][] = [
    ["Stage 1", stageCount(1), "bg-clinical"], ["Stage 2", stageCount(2), "bg-clinical"],
    ["Stage 3", stageCount(3), "bg-primary"], ["Stage 4", stageCount(4), "bg-primary"],
    ["Stage 5", stageCount(5), "bg-critical"],
    ["In queue", patients.filter((p) => p.status === "queue").length, "bg-warning"],
    ["Discharged", patients.filter((p) => p.status === "completed").length, "bg-success"],
  ];
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return <section className="rounded-lg border border-border bg-surface p-5 panel-shadow"><h2 className="font-bold">Movement between stages</h2><p className="mt-1 text-xs text-muted-foreground">Patients recorded in each stage</p><div className="mt-4 space-y-2">{rows.map(([name, count, color]) => <div key={name} className="grid grid-cols-[72px_1fr_22px] items-center gap-2 text-xs"><span>{name}</span><div className="h-2 rounded-full bg-secondary"><div className={`h-full rounded-full ${color}`} style={{ width: `${(count / max) * 100}%` }} /></div><strong>{count}</strong></div>)}</div></section>;
}

function StaffAllocation({ snapshot }: { snapshot: Snapshot }) {
  return <section className="rounded-lg border border-border bg-surface p-5"><Label>Staff & resource allocation</Label><div className="mt-4 max-h-96 space-y-3 overflow-y-auto">{staffRoster.map((s) => { const busy = snapshot.busy.has(s.id); return <div key={s.id} className="grid grid-cols-[1fr_auto] border-b border-border pb-3 text-sm"><div><strong>{s.name}</strong><p className="text-xs text-muted-foreground">{s.years}y · {s.tier} · home {s.home}</p></div><span className={`self-center rounded-full px-2 py-1 text-xs ${busy ? "bg-secondary text-primary" : "bg-success-soft text-success"}`}>{busy ? "Occupied" : "Free"}</span></div>; })}</div></section>;
}
