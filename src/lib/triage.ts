export type Vitals = {
  systolic: number;
  diastolic: number;
  spo2: number;
  heartRate: number;
  respiration: number;
  pain: number;
  consciousness: "Alert" | "Voice" | "Pain" | "Unresponsive";
};

export type TriageResult = {
  score: number;
  stage: 1 | 2 | 3 | 4 | 5;
  category: "GREEN" | "YELLOW" | "RED";
  reasons: { points: number; text: string }[];
};

export function calculateTriage(vitals: Vitals, age: number): TriageResult {
  const reasons: TriageResult["reasons"] = [];
  const add = (points: number, text: string) => reasons.push({ points, text });

  add(vitals.spo2 < 90 ? 3 : vitals.spo2 < 95 ? 2 : 0, vitals.spo2 >= 95 ? `SpO₂ ${vitals.spo2}% is within the normal range (≥95%).` : `SpO₂ ${vitals.spo2}% is below the normal range (≥95%).`);
  add(vitals.respiration < 10 || vitals.respiration > 24 ? 2 : vitals.respiration < 12 || vitals.respiration > 20 ? 1 : 0, `Respiration ${vitals.respiration}/min is ${vitals.respiration >= 12 && vitals.respiration <= 20 ? "normal" : "abnormal"} (normal 12–20/min).`);
  add(vitals.heartRate < 50 || vitals.heartRate > 120 ? 2 : vitals.heartRate < 60 || vitals.heartRate > 100 ? 1 : 0, `Heart rate ${vitals.heartRate} bpm is ${vitals.heartRate >= 60 && vitals.heartRate <= 100 ? "normal" : "outside the usual range"} (normal 60–100 bpm).`);
  add(vitals.systolic < 90 || vitals.systolic > 160 ? 2 : vitals.systolic > 140 ? 1 : 0, `Systolic BP ${vitals.systolic} mmHg is ${vitals.systolic >= 90 && vitals.systolic <= 140 ? "normal" : "abnormal"} (normal 90–140 mmHg).`);
  add(vitals.diastolic < 60 || vitals.diastolic > 100 ? 2 : vitals.diastolic > 90 ? 1 : 0, `Diastolic BP ${vitals.diastolic} mmHg is ${vitals.diastolic >= 60 && vitals.diastolic <= 90 ? "normal" : "abnormal"} (normal 60–90 mmHg).`);
  add(age >= 75 ? 2 : age >= 60 ? 1 : 0, `Age ${age} ${age >= 60 ? "is in a higher-risk bracket" : "is not in a higher-risk bracket"}.`);
  add(vitals.pain >= 8 ? 2 : vitals.pain >= 4 ? 1 : 0, `Pain level ${vitals.pain}/10 is ${vitals.pain >= 8 ? "severe" : vitals.pain >= 4 ? "moderate" : "low"}.`);
  const consciousnessPoints = { Alert: 0, Voice: 1, Pain: 2, Unresponsive: 3 }[vitals.consciousness];
  add(consciousnessPoints, `Patient is ${vitals.consciousness.toLowerCase()}${vitals.consciousness === "Alert" ? " and fully responsive" : " to stimulus"}.`);

  const score = reasons.reduce((total, reason) => total + reason.points, 0);
  const stage = (score >= 11 ? 5 : score >= 8 ? 4 : score >= 5 ? 3 : score >= 2 ? 2 : 1) as TriageResult["stage"];
  return { score, stage, category: stage === 5 ? "RED" : stage >= 3 ? "YELLOW" : "GREEN", reasons };
}

export function erlangB(offeredLoad: number, servers: number) {
  let probability = 1;
  for (let i = 1; i <= servers; i += 1) probability = (offeredLoad * probability) / (i + offeredLoad * probability);
  return probability;
}