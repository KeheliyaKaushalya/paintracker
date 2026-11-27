import { formatBp } from "../../domain/clinical/bp";
import { hhmm, nowHHMM, todayISO } from "../../domain/clinical/dates";
import type { Round } from "../../domain/clinical/models";
import type { RoundFormValues } from "../../domain/rounds/schemas";

const defaultSession = () =>
  new Date().getHours() < 12 ? "Morning" : "Evening";

export function initialValues(
  kind: "pain" | "ward",
  from?: Round,
): RoundFormValues {
  if (from) {
    const n = (v: number | null) => (v == null ? "" : String(v));
    return {
      kind: from.kind === "ward" ? "ward" : "pain",
      round_date: from.round_date,
      round_time: hhmm(from.round_time),
      session: from.session ?? "",
      pain_rest: from.pain_rest,
      pain_move: from.pain_move,
      rr: n(from.rr),
      spo2: n(from.spo2),
      hr: n(from.hr),
      pain_cough: from.pain_cough,
      pain_physio: from.pain_physio,
      use_cough: from.pain_cough != null,
      use_physio: from.pain_physio != null,
      bp: formatBp(from.bp_sys, from.bp_dia),
      gcs: n(from.gcs),
      mobilization: from.mobilization ?? "",
      tags: from.tags,
      note: from.note ?? "",
    };
  }
  return {
    kind,
    round_date: todayISO(),
    round_time: nowHHMM(),
    session: defaultSession(),
    pain_rest: null,
    pain_move: null,
    rr: "",
    spo2: "",
    hr: "",
    bp: "",
    gcs: "",
    mobilization: "",
    tags: [],
    note: "",
    pain_cough: null,
    pain_physio: null,
    use_cough: false,
    use_physio: false,
  };
}
