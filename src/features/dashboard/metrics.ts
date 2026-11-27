import type { PatientFull } from "../../domain/clinical/models";
import { isOpen } from "../../domain/clinical/alerts";
import { effectiveRounds, latestPainRound } from "../../domain/clinical/rounds";
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
    attention: sortBoard(patients.filter(p => isUrgent(p) || hasSeverePain(p) || hasOpenAlert(p))),
    severe: patients.filter(hasSeverePain),
    alerts: patients.filter(hasOpenAlert),
    assessed: patients.filter(p => assessedToday(p, date)),
    notAssessed: patients.filter(p => !assessedToday(p, date)),
  };
}
