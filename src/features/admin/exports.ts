import { supabase } from "../../infrastructure/supabase/supabase";
import type {
  Patient,
  Round,
  PatientMed,
  PatientAlert,
  MedChange,
} from "../../domain/clinical/models";
import { effectiveRounds, newestFirst } from "../../domain/clinical/rounds";
import { allRows } from "./management";
export type ExportKind =
  | "ods"
  | "summary"
  | "full"
  | "patients"
  | "rounds"
  | "medications"
  | "dose"
  | "notes"
  | "wards";
import {
  toOds,
  toCsv,
  download,
  type Cell,
} from "../../infrastructure/platform/export";
type Sheet = Cell[][];
const xml = (v: Cell) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export async function exportRecords(
  kind: ExportKind,
  scope: string,
  identify: boolean,
) {
  const patients = await allRows<Patient>((a, b) =>
    supabase
      .from("patients")
      .select("*")
      .is("deleted_at", null)
      .order("id")
      .range(a, b),
  );
  const selected = patients.filter(
    (p) => scope === "all" || p.status === scope,
  );
  const ids = new Map(selected.map((p, i) => [p.id, `P${i + 1}`]));
  const [rounds, meds, notes, wards, changes] = await Promise.all([
    allRows<Round>((a, b) =>
      supabase.from("rounds").select("*").order("id").range(a, b),
    ),
    allRows<PatientMed>((a, b) =>
      supabase.from("patient_meds").select("*").order("id").range(a, b),
    ),
    allRows<PatientAlert>((a, b) =>
      supabase.from("patient_alerts").select("*").order("id").range(a, b),
    ),
    allRows<{ name: string }>((a, b) =>
      supabase.from("wards").select("*").order("name").range(a, b),
    ),
    allRows<MedChange>((a, b) =>
      supabase.from("patient_med_changes").select("*").order("id").range(a, b),
    ),
  ]);
  const rr = effectiveRounds(rounds.filter((r) => ids.has(r.patient_id))).sort(
    newestFirst,
  );
  const roundRow = (r: Round): Cell[] => [
    ids.get(r.patient_id),
    r.round_date,
    r.round_time,
    r.kind,
    r.pain_rest,
    r.pain_move,
    r.rr,
    r.spo2,
    r.hr,
    r.bp_sys,
    r.bp_dia,
    r.gcs,
    identify ? r.note : "",
  ];
  const sheets: Record<string, Sheet> = {
    patients: [
      [
        "Reference",
        ...(identify ? ["Name", "BHT"] : []),
        "Age",
        "Sex",
        "Ward",
        "Status",
        "Category",
      ],
      ...selected.map((p) => [
        ids.get(p.id),
        ...(identify ? [p.full_name, p.bht] : []),
        p.age,
        p.sex,
        p.ward,
        p.status,
        p.category,
      ]),
    ],
    rounds: [
      [
        "Reference",
        "Date",
        "Time",
        "Kind",
        "Pain rest",
        "Pain movement",
        "RR",
        "SpO2",
        "HR",
        "BP systolic",
        "BP diastolic",
        "GCS",
        "Note",
      ],
      ...rr.map(roundRow),
    ],
    medications: [
      ["Reference", "Drug", "Route", "Dose", "Frequency"],
      ...meds
        .filter((m) => ids.has(m.patient_id))
        .map((m) => [
          ids.get(m.patient_id),
          identify ? m.drug : "",
          m.route,
          identify ? m.dose : "",
          identify ? m.freq : "",
        ]),
    ],
    dose: [
      [
        "Reference",
        "Date",
        "Previous dose",
        "New dose",
        "Previous frequency",
        "New frequency",
        "Reason",
      ],
      ...changes
        .filter((r) => ids.has(r.patient_id))
        .map((r) => [
          ids.get(r.patient_id),
          r.changed_at,
          identify ? r.from_dose : "",
          identify ? r.to_dose : "",
          identify ? r.from_freq : "",
          identify ? r.to_freq : "",
          identify ? r.reason : "",
        ]),
    ],
    notes: [
      ["Reference", "Date", "Note"],
      ...notes
        .filter((n) => ids.has(n.patient_id))
        .map((n) => [
          ids.get(n.patient_id),
          n.created_at,
          identify ? n.alert_text : "",
        ]),
    ],
    wards: [
      ["Ward", "Active", "Total"],
      ...[
        ...new Set([
          ...wards.map((w) => w.name),
          ...selected.map((p) => p.ward),
        ]),
      ].map((w) => [
        w,
        selected.filter((p) => p.ward === w && p.status === "active").length,
        selected.filter((p) => p.ward === w).length,
      ]),
    ],
  };
  const { error } = await supabase.rpc("log_export", {
    description: `${kind} export (${scope}, ${
      identify ? "identified" : "reduced identifiers"
    })`,
    export_kind: kind,
    row_count:
      kind === "ods" || kind === "full" || kind === "summary"
        ? selected.length
        : sheets[kind].length - 1,
  });
  if (error) throw new Error(error.message);
  if (kind === "ods") {
    download(
      "patient-records.ods",
      toOds(Object.entries(sheets).map(([name, rows]) => ({ name, rows }))),
      "application/vnd.oasis.opendocument.spreadsheet",
    );
    return;
  }
  if (kind === "summary" || kind === "full") {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0";
    document.body.append(frame);
    const doc = frame.contentDocument;
    if (!doc) {
      frame.remove();
      throw new Error("Print unavailable");
    }
    const latest = selected.flatMap((p) =>
      rr.filter((r) => r.patient_id === p.id).slice(0, 1),
    );
    const report =
      kind === "summary"
        ? {
            patients: sheets.patients,
            rounds: [sheets.rounds[0], ...latest.map(roundRow)],
          }
        : sheets;
    doc.open();
    doc.write(
      `<html><head><title>Patient report</title><style>body{font:10px sans-serif}table{border-collapse:collapse;width:100%}td{border:1px solid #aaa;padding:4px}tr{break-inside:avoid}</style></head><body>${Object.entries(
        report,
      )
        .map(
          ([n, rows]) =>
            `<h2>${xml(n)}</h2><table>${rows
              .map(
                (r) =>
                  `<tr>${r.map((c) => `<td>${xml(c)}</td>`).join("")}</tr>`,
              )
              .join("")}</table>`,
        )
        .join("")}</body></html>`,
    );
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60000);
    return;
  }
  download(`${kind}.csv`, toCsv(sheets[kind]), "text/csv;charset=utf-8");
}
