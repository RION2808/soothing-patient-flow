import type { Gender, Vitals } from "./triage";

export type Group = "GREEN" | "YELLOW" | "RED";
export type BedKind = "room" | "hall";
export type Tier = "ELE" | "ME" | "HE";
export type Role = "Doctor" | "Nurse" | "Intern";

export type Bed = { id: string; group: Group; kind: BedKind };
export type Staff = { id: string; name: string; role: Role; tier: Tier; years: number; home: Group };

export type PatientStatus = "queue" | "treatment" | "completed";

export type Patient = {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  category: Group;
  stage: number;
  score: number;
  status: PatientStatus;
  bedId: string | null;
  bedKind: BedKind | null;
  borrowedBed: boolean;
  doctorId: string | null;
  nurseId: string | null;
  internId: string | null;
  nurseLed: boolean;
  arrivedAt: number;
  startedAt: number | null;
  endsAt: number | null;
  completedAt: number | null;
  vitals: Vitals;
  note: string;
  escalation: string | null;
  source: "monitor" | "manual";
};

/** Yellow deliberately has the most beds, mostly hall beds with a few private rooms. */
export const bedInventory: Bed[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `G-${String(i + 1).padStart(2, "0")}`, group: "GREEN" as Group, kind: "room" as BedKind })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `Y-${String(i + 1).padStart(2, "0")}`, group: "YELLOW" as Group, kind: "room" as BedKind })),
  ...Array.from({ length: 16 }, (_, i) => ({ id: `YH-${String(i + 1).padStart(2, "0")}`, group: "YELLOW" as Group, kind: "hall" as BedKind })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `R-${String(i + 1).padStart(2, "0")}`, group: "RED" as Group, kind: "room" as BedKind })),
];

const doctorNames: [string, Tier, number, Group][] = [
  ["Dr. Helen Voss", "HE", 22, "RED"], ["Dr. Farah Idris", "HE", 19, "RED"], ["Dr. Ritu Bhatia", "HE", 17, "RED"],
  ["Dr. Samuel Otieno", "HE", 16, "RED"], ["Dr. Ana Duarte", "HE", 15, "RED"],
  ["Dr. Arun Vaidya", "ME", 9, "YELLOW"], ["Dr. Mei Ling", "ME", 8, "YELLOW"], ["Dr. Omar Haddad", "ME", 7, "YELLOW"],
  ["Dr. Priya Nair", "ME", 7, "YELLOW"], ["Dr. Jonas Weber", "ME", 6, "YELLOW"], ["Dr. Sana Qureshi", "ME", 5, "YELLOW"],
  ["Dr. Ishan Rao", "ELE", 3, "GREEN"], ["Dr. Clara Mendes", "ELE", 2, "GREEN"], ["Dr. Tobias Lang", "ELE", 2, "GREEN"],
  ["Dr. Nadia Karim", "ELE", 1, "GREEN"],
];

const nurseNames: [string, Tier, number, Group][] = [
  ["Nurse Grace Miller", "HE", 11, "RED"], ["Nurse Yusuf Demir", "HE", 9, "RED"], ["Nurse Bea Santos", "HE", 8, "RED"],
  ["Nurse Lena Fischer", "HE", 7, "RED"],
  ["Nurse Ivy Chen", "ME", 5, "YELLOW"], ["Nurse Diana Krishnan", "ME", 4, "YELLOW"], ["Nurse Paulo Reis", "ME", 4, "YELLOW"],
  ["Nurse Amara Okoye", "ME", 3, "YELLOW"], ["Nurse Ella Park", "ME", 3, "YELLOW"],
  ["Nurse Sara Haq", "ELE", 1, "GREEN"], ["Nurse Tom Becker", "ELE", 1, "GREEN"], ["Nurse Lily Xu", "ELE", 0.5, "GREEN"],
];

const internNames: [string, number][] = [
  ["Karan Malhotra", 0.5], ["Elena Petrova", 0.5], ["Noel Fernandes", 0.4], ["Ayesha Siddiqui", 0.3],
  ["Miguel Alves", 0.3], ["Hannah Cole", 0.2],
];

export const staffRoster: Staff[] = [
  ...doctorNames.map(([name, tier, years, home], i) => ({ id: `D${i + 1}`, name, role: "Doctor" as Role, tier, years, home })),
  ...nurseNames.map(([name, tier, years, home], i) => ({ id: `N${i + 1}`, name, role: "Nurse" as Role, tier, years, home })),
  ...internNames.map(([name, years], i) => ({ id: `I${i + 1}`, name, role: "Intern" as Role, tier: "ELE" as Tier, years, home: "GREEN" as Group })),
];

export const staffById = (id: string | null) => staffRoster.find((s) => s.id === id) ?? null;
export const bedById = (id: string | null) => bedInventory.find((b) => b.id === id) ?? null;

/** Tier preference: red is covered by the most experienced crews, green by the newest, and every tier can flow across groups. */
const tierPreference: Record<Group, Tier[]> = {
  RED: ["HE", "ME", "ELE"],
  YELLOW: ["ME", "HE", "ELE"],
  GREEN: ["ELE", "ME", "HE"],
};

const borrowOrder: Record<Group, Group[]> = {
  RED: ["YELLOW", "GREEN"],
  YELLOW: ["GREEN", "RED"],
  GREEN: ["YELLOW", "RED"],
};

export function findBed(occupied: Set<string>, category: Group, stage: number) {
  const free = bedInventory.filter((b) => !occupied.has(b.id));
  const own = free.filter((b) => b.group === category);
  const needsRoom = category !== "YELLOW" || stage >= 4;
  const ordered =
    category === "YELLOW"
      ? needsRoom
        ? [...own.filter((b) => b.kind === "room"), ...own.filter((b) => b.kind === "hall")]
        : [...own.filter((b) => b.kind === "hall"), ...own.filter((b) => b.kind === "room")]
      : own;
  if (ordered[0]) return { bed: ordered[0], borrowed: false };
  for (const group of borrowOrder[category]) {
    const bed = free.find((b) => b.group === group);
    if (bed) return { bed, borrowed: true };
  }
  return null;
}

export function findStaff(busy: Set<string>, role: Role, category: Group) {
  const free = staffRoster.filter((s) => s.role === role && !busy.has(s.id));
  for (const tier of tierPreference[category]) {
    const match = free.find((s) => s.tier === tier);
    if (match) return match;
  }
  return free[0] ?? null;
}

const treatmentSeconds: Record<Group, number> = { RED: 60, YELLOW: 45, GREEN: 30 };

/** Queue rules: green is first-come-first-served, red is chronological, and yellow puts stage 4 first while ageing stage 3 so nobody stalls. */
export function sortQueue(list: Patient[], now: number) {
  return [...list].sort((a, b) => {
    if (a.category === "YELLOW" && b.category === "YELLOW") {
      const weight = (p: Patient) => {
        const waitedMinutes = (now - p.arrivedAt) / 60000;
        if (p.stage >= 4) return 0;
        return waitedMinutes >= 8 ? 0.5 : 1;
      };
      const diff = weight(a) - weight(b);
      if (diff !== 0) return diff;
    }
    return a.arrivedAt - b.arrivedAt;
  });
}

const groupPriority: Group[] = ["RED", "YELLOW", "GREEN"];

export type AllocationEvent = { text: string; tone: "info" | "warning" | "critical" | "success" };

/** One simulation tick: finish completed treatments, then allocate resources to the queue by priority. */
export function advanceFloor(patients: Patient[], now: number): { patients: Patient[]; events: AllocationEvent[] } {
  const events: AllocationEvent[] = [];
  let next = patients.map((p) => {
    if (p.status === "treatment" && p.endsAt && now >= p.endsAt) {
      events.push({ text: `${p.name} completed treatment in ${p.bedId} and was discharged to main records.`, tone: "success" });
      return { ...p, status: "completed" as PatientStatus, completedAt: now, bedId: null, bedKind: null, doctorId: null, nurseId: null, internId: null, escalation: null };
    }
    return p;
  });

  const occupied = new Set(next.filter((p) => p.bedId).map((p) => p.bedId as string));
  const busy = new Set(next.flatMap((p) => (p.status === "treatment" ? [p.doctorId, p.nurseId, p.internId] : [])).filter(Boolean) as string[]);

  for (const group of groupPriority) {
    const queued = sortQueue(next.filter((p) => p.status === "queue" && p.category === group), now);
    for (const patient of queued) {
      const placement = findBed(occupied, patient.category, patient.stage);
      if (!placement) {
        next = next.map((p) => (p.id === patient.id ? { ...p, escalation: "No bed free in any group — enquire with nearby hospitals for transfer, then re-check severity." } : p));
        events.push({ text: `${patient.name} is waiting without a bed. Enquire with nearby hospitals.`, tone: "critical" });
        continue;
      }
      const doctor = findStaff(busy, "Doctor", patient.category);
      const nurse = findStaff(busy, "Nurse", patient.category);
      if (!nurse) {
        next = next.map((p) => (p.id === patient.id ? { ...p, escalation: "No clinical staff free — hold in queue and call in the reserve crew." } : p));
        continue;
      }
      const intern = patient.category === "RED" ? null : findStaff(busy, "Intern", patient.category);
      occupied.add(placement.bed.id);
      busy.add(nurse.id);
      if (doctor) busy.add(doctor.id);
      if (intern) busy.add(intern.id);

      const escalation = !doctor
        ? `No doctor free — ${nurse.name} is leading care under ${patient.category} protocol until a doctor is released.`
        : placement.borrowed
          ? `Free-flow bed borrowed from the ${placement.bed.group} group during peak load.`
          : null;

      next = next.map((p) =>
        p.id === patient.id
          ? {
              ...p,
              status: "treatment" as PatientStatus,
              bedId: placement.bed.id,
              bedKind: placement.bed.kind,
              borrowedBed: placement.borrowed,
              doctorId: doctor?.id ?? null,
              nurseId: nurse.id,
              internId: intern?.id ?? null,
              nurseLed: !doctor,
              startedAt: now,
              endsAt: now + treatmentSeconds[patient.category] * 1000,
              escalation,
            }
          : p,
      );
      events.push({
        text: `${patient.name} placed in ${placement.bed.id} (${placement.bed.kind}) with ${doctor ? doctor.name : nurse.name}${intern ? ` and intern ${intern.name}` : ""}.`,
        tone: placement.borrowed || !doctor ? "warning" : "info",
      });
    }
  }
  return { patients: next, events };
}

export function capacity(patients: Patient[]) {
  const occupied = new Set(patients.filter((p) => p.bedId).map((p) => p.bedId as string));
  const busy = new Set(patients.flatMap((p) => (p.status === "treatment" ? [p.doctorId, p.nurseId, p.internId] : [])).filter(Boolean) as string[]);
  const perGroup = (["GREEN", "YELLOW", "RED"] as Group[]).map((group) => {
    const groupBeds = bedInventory.filter((b) => b.group === group);
    return {
      group,
      beds: groupBeds.length,
      free: groupBeds.filter((b) => !occupied.has(b.id)).length,
      rooms: groupBeds.filter((b) => b.kind === "room").length,
      roomsFree: groupBeds.filter((b) => b.kind === "room" && !occupied.has(b.id)).length,
      halls: groupBeds.filter((b) => b.kind === "hall").length,
      hallsFree: groupBeds.filter((b) => b.kind === "hall" && !occupied.has(b.id)).length,
      doctorsFree: staffRoster.filter((s) => s.role === "Doctor" && s.home === group && !busy.has(s.id)).length,
      doctors: staffRoster.filter((s) => s.role === "Doctor" && s.home === group).length,
      nursesFree: staffRoster.filter((s) => s.role === "Nurse" && s.home === group && !busy.has(s.id)).length,
      nurses: staffRoster.filter((s) => s.role === "Nurse" && s.home === group).length,
    };
  });
  return { occupied, busy, perGroup, totalBeds: bedInventory.length, occupiedBeds: occupied.size };
}

export const vitalsLine = (v: Vitals) => `${v.heartRate} bpm · SpO₂ ${v.spo2}% · ${v.systolic}/${v.diastolic}`;

/** Simulated bedside monitor feed; gender shifts the generated baseline. */
export function readMonitor(gender: Gender, age: number): Vitals {
  const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
  const female = gender === "Female";
  const stress = Math.random();
  const severe = stress > 0.72;
  return {
    systolic: rand(female ? 96 : 100, severe ? 178 : female ? 138 : 142) + (age > 65 ? 8 : 0),
    diastolic: rand(female ? 60 : 62, severe ? 104 : 92),
    spo2: severe ? rand(83, 93) : rand(95, 99),
    heartRate: severe ? rand(112, 142) : rand(female ? 66 : 62, female ? 104 : 98),
    respiration: severe ? rand(22, 30) : rand(13, 19),
    pain: severe ? rand(7, 10) : rand(0, 5),
    consciousness: severe ? (Math.random() > 0.6 ? "Voice" : "Pain") : "Alert",
  };
}
