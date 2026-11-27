import type { PatientFull } from "../../domain/clinical/models";
import { isOpen } from "../../domain/clinical/alerts";
import { effectiveRounds, latestPainRound } from "../../domain/clinical/rounds";
import { isActiveMed } from "../../domain/clinical/meds";
import { painLevel } from "../../domain/clinical/pain";
import { isUrgent, sortBoard } from "../patients/filters";

export function hasSeverePain(p: PatientFull) {
  const r = latestPainRound(p.rounds);
  return [r?.pain_rest, r?.pain_move].some(v => v != null && painLevel(v) === "high");
}
export const hasOpenAlert = (p: PatientFull) => p.patient_alerts.some(isOpen);
export const assessedToday = (p: PatientFull, date: string) =>
  effectiveRounds(p.rounds).some(r => r.kind === "pain" && r.round_date === date);
export function dashboardGroups(patients: PatientFull[], date: string) {
  return {
    all: patients,
    epidural: patients.filter(p => p.has_epidural),
    medications: patients.filter(p => p.patient_meds.some(isActiveMed)),
    attention: sortBoard(patients.filter(p => isUrgent(p) || hasSeverePain(p) || hasOpenAlert(p))).sort((a,b) => priority(b)-priority(a)),
    severe: patients.filter(hasSeverePain),
    alerts: patients.filter(hasOpenAlert),
    assessed: patients.filter(p => assessedToday(p, date)),
    notAssessed: patients.filter(p => !assessedToday(p, date)),
  };
}

export function priority(p: PatientFull) {
  return Number(isUrgent(p)) * 4 + Number(hasSeverePain(p)) * 2 + Number(hasOpenAlert(p));
}

export function painDistribution(patients: PatientFull[]) {
  const counts = { low: 0, mid: 0, high: 0, missing: 0 };
  for (const p of patients) {
    const r = latestPainRound(p.rounds);
    const scores = [r?.pain_rest, r?.pain_move].filter((v): v is number => v != null);
    counts[scores.length ? painLevel(Math.max(...scores)) : "missing"]++;
  }
  return counts;
}

export function painTrends(patients: PatientFull[], dates: string[]) {
  return dates.map(date => {
    const rounds = patients.flatMap(p => effectiveRounds(p.rounds).filter(r => r.kind === "pain" && r.round_date === date));
    const mean = (key: "pain_rest" | "pain_move") => {
      const scores = rounds.map(r => r[key]).filter((v): v is number => v != null);
      return { mean: scores.length ? scores.reduce((a,b) => a+b,0)/scores.length : null, n: scores.length };
    };
    return { date, rest: mean("pain_rest"), move: mean("pain_move") };
  });
}
