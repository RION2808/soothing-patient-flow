export type Gender = "Female" | "Male" | "Other";

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

/** Reference ranges differ slightly by sex, so triage uses gender-aware bands. */
export function referenceRanges(gender: Gender) {
  const female = gender === "Female";
  return {
    heartRate: female ? ([62, 105] as const) : ([58, 100] as const),
    systolic: female ? ([85, 135] as const) : ([90, 140] as const),
    diastolic: female ? ([58, 88] as const) : ([60, 90] as const),
    respiration: [12, 20] as const,
    spo2: 95,
  };
}

export function calculateTriage(vitals: Vitals, age: number, gender: Gender = "Other"): TriageResult {
  const ranges = referenceRanges(gender);
  const reasons: TriageResult["reasons"] = [];
  const add = (points: number, text: string) => reasons.push({ points, text });

  add(
    vitals.spo2 < 90 ? 3 : vitals.spo2 < ranges.spo2 ? 2 : 0,
    vitals.spo2 >= ranges.spo2
      ? `SpO₂ ${vitals.spo2}% is within the normal range (≥${ranges.spo2}%).`
      : `SpO₂ ${vitals.spo2}% is below the normal range (≥${ranges.spo2}%).`,
  );

  const band = (value: number, [low, high]: readonly [number, number], slack: number) =>
    value < low - slack || value > high + slack ? 2 : value < low || value > high ? 1 : 0;

  add(band(vitals.respiration, ranges.respiration, 4), `Respiration ${vitals.respiration}/min against the normal ${ranges.respiration[0]}–${ranges.respiration[1]}/min.`);
  add(band(vitals.heartRate, ranges.heartRate, 20), `Heart rate ${vitals.heartRate} bpm against the ${gender.toLowerCase()} range ${ranges.heartRate[0]}–${ranges.heartRate[1]} bpm.`);
  add(band(vitals.systolic, ranges.systolic, 20), `Systolic BP ${vitals.systolic} mmHg against the ${gender.toLowerCase()} range ${ranges.systolic[0]}–${ranges.systolic[1]} mmHg.`);
  add(band(vitals.diastolic, ranges.diastolic, 12), `Diastolic BP ${vitals.diastolic} mmHg against the ${gender.toLowerCase()} range ${ranges.diastolic[0]}–${ranges.diastolic[1]} mmHg.`);
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
