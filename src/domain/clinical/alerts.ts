import type { PatientAlertWithAcks, PatientFull } from "./models";

export const isOpen = (a: PatientAlertWithAcks) => !a.resolved_at;

/** The creator counts as having seen their own alert. */
export const needsMyAck = (a: PatientAlertWithAcks, userId: string) =>
  isOpen(a) &&
  a.created_by !== userId &&
  !a.patient_alert_acks.some((k) => k.user_id === userId);

/** How many patients have an alert this user has not acknowledged. */
export const unseenCount = (list: PatientFull[], userId: string) =>
  list.filter((p) => p.patient_alerts.some((a) => needsMyAck(a, userId)))
    .length;
