import { isActiveMed } from "../../domain/clinical/meds";
import { fmtStamp } from "../../domain/clinical/dates";
import type { MedChange, PatientMed } from "../../domain/clinical/models";

export function DoseHistory({
  changes,
  nameOf,
}: {
  changes: MedChange[];
  nameOf: (id: string) => string;
}) {
  if (changes.length === 0) return null;
  return (
    <details className="history">
      <summary>Dose history ({changes.length})</summary>
      {changes.map((c) => (
        <p key={c.id} className="mono" style={{ marginTop: 4 }}>
          {fmtStamp(c.changed_at)} ·{" "}
          {[c.from_dose, c.from_freq].filter(Boolean).join(" ") || "—"} →{" "}
          {[c.to_dose, c.to_freq].filter(Boolean).join(" ") || "—"} ·{" "}
          {nameOf(c.changed_by)}
          {c.reason ? ` · ${c.reason}` : ""}
        </p>
      ))}
    </details>
  );
}

export function HistoryDialog({
  med,
  changes,
  nameOf,
  onClose,
}: {
  med: PatientMed;
  changes: MedChange[];
  nameOf: (id: string) => string;
  onClose: () => void;
}) {
  const ordered = [...changes].sort((a, b) =>
    a.changed_at.localeCompare(b.changed_at),
  );
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mh-t"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="mh-t">History: {med.drug}</h2>

        {med.started_at && (
          <p className="mono">
            {fmtStamp(med.started_at)} · Added by{" "}
            {med.started_by ? nameOf(med.started_by) : "unknown"}
          </p>
        )}

        {ordered.length === 0 && <p className="faint">No dose changes yet.</p>}
        {ordered.map((c) => (
          <p key={c.id} className="mono">
            {fmtStamp(c.changed_at)} ·{" "}
            {[c.from_dose, c.from_freq].filter(Boolean).join(" ") || "—"} →{" "}
            {[c.to_dose, c.to_freq].filter(Boolean).join(" ") || "—"} ·{" "}
            {nameOf(c.changed_by)}
            {c.reason ? ` · ${c.reason}` : ""}
          </p>
        ))}

        {!isActiveMed(med) && (
          <p className="mono">
            {fmtStamp(med.ended_at)} ·{" "}
            {med.status === "removed" ? "Entered in error" : "Stopped"} by{" "}
            {med.ended_by ? nameOf(med.ended_by) : "unknown"}
            {med.end_reason ? ` · ${med.end_reason}` : ""}
          </p>
        )}

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
