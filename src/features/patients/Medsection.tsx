import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "../../shared/components/Toast";
import { PromptDialog } from "../../shared/components/ui";
import { fmtStamp } from "../../domain/clinical/dates";
import { isActiveMed, medFreqLabel } from "../../domain/clinical/meds";
import type { PatientMed } from "../../domain/clinical/models";
import {
  addMed,
  endMed,
  type NewMed,
} from "../../infrastructure/repositories/patients";
import { useMedChanges } from "./hooks";

import { AddMedForm } from "./AddMedForm";
import { ChangeDoseDialog } from "./ChangeDoseDialog";
import { DoseHistory, HistoryDialog } from "./MedicationHistory";

type Dialog =
  | { kind: "dose"; med: PatientMed }
  | { kind: "history"; med: PatientMed }
  | { kind: "stopped" | "removed"; med: PatientMed }
  | null;

export function MedSection({
  patientId,
  meds,
  editable,
  nameOf,
}: {
  patientId: string;
  meds: PatientMed[];
  editable: boolean;
  nameOf: (id: string) => string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const changesQ = useMedChanges(patientId);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  // no early return: the add form must still show when a patient has no meds yet
  const sorted = [...meds].sort((a, b) => a.sort_order - b.sort_order);
  const current = sorted.filter(isActiveMed);
  const ended = sorted.filter((m) => !isActiveMed(m));
  const changesFor = (id: string) =>
    (changesQ.data ?? []).filter((c) => c.med_id === id);

  async function end(
    status: "stopped" | "removed",
    med: PatientMed,
    reason: string,
  ) {
    setBusy(true);
    setEndError(null);
    try {
      await endMed(med.id, status, reason);
      await qc.invalidateQueries();
      toast(
        status === "stopped"
          ? "Medication stopped"
          : "Medication entry removed",
      );
      setDialog(null);
    } catch (e) {
      setEndError(
        e instanceof Error ? e.message : "Could not update the medication",
      );
    } finally {
      setBusy(false);
    }
  }

  async function add(m: NewMed) {
    const nextOrder =
      meds.reduce((max, x) => Math.max(max, x.sort_order), 0) + 1;
    await addMed(patientId, m, nextOrder);
    await qc.invalidateQueries();
    toast("Medication added");
  }

  return (
    <section aria-labelledby="med-h">
      <h2 className="section-title" id="med-h">
        Medications
      </h2>
      {current.length === 0 && <p className="faint">No active medications.</p>}

      {current.length > 0 && (
        <div className="table-wrap">
          <table className="med-table">
            <thead>
              <tr>
                <th>Drug</th>
                <th>Route</th>
                <th>Dose</th>
                <th>Frequency</th>
                <th>Top-up</th>
              </tr>
            </thead>
            {current.map((m) => (
              <tbody key={m.id}>
                <tr className="med-main">
                  <td>
                    <strong>{m.drug}</strong>
                    {m.dosing === "loading" && (
                      <div className="faint">loading dose</div>
                    )}
                    {m.started_at && (
                      <div className="faint">
                        Added by{" "}
                        {m.started_by ? nameOf(m.started_by) : "unknown"} ·{" "}
                        {fmtStamp(m.started_at)}
                      </div>
                    )}
                  </td>
                  <td>{m.route}</td>
                  <td>
                    <strong>{m.dose ?? "—"}</strong>
                  </td>
                  <td>{medFreqLabel(m)}</td>
                  <td>{m.topup ?? "—"}</td>
                </tr>
                <tr className="med-actions-row">
                  <td colSpan={5}>
                    <div className="med-actions">
                      {editable && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setDialog({ kind: "dose", med: m })}
                        >
                          Change dose
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setDialog({ kind: "history", med: m })}
                      >
                        History
                      </button>
                      {editable && (
                        <>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setEndError(null);
                              setDialog({ kind: "stopped", med: m });
                            }}
                          >
                            Stop
                          </button>
                          <button
                            className="btn btn-outline btn-sm btn-error-outline"
                            onClick={() => {
                              setEndError(null);
                              setDialog({ kind: "removed", med: m });
                            }}
                          >
                            Entered in error
                          </button>{" "}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            ))}
          </table>
        </div>
      )}

      {editable && <AddMedForm onAdd={add} />}

      {ended.length > 0 && (
        <details className="history" style={{ marginTop: 8 }}>
          <summary>Stopped / removed medications ({ended.length})</summary>
          {ended.map((m) => (
            <div key={m.id} style={{ marginTop: 8 }}>
              <p className="mono">
                <strong>{m.drug}</strong>{" "}
                {[m.route, m.dose, medFreqLabel(m)].filter(Boolean).join(" · ")}{" "}
                — {m.status === "removed" ? "entered in error" : "stopped"} by{" "}
                {m.ended_by ? nameOf(m.ended_by) : "unknown"},{" "}
                {fmtStamp(m.ended_at)}
                {m.end_reason ? ` — ${m.end_reason}` : ""}
              </p>
              <DoseHistory changes={changesFor(m.id)} nameOf={nameOf} />
            </div>
          ))}
        </details>
      )}

      {dialog?.kind === "dose" && (
        <ChangeDoseDialog
          med={dialog.med}
          onClose={() => setDialog(null)}
          onDone={() => {
            void qc.invalidateQueries();
            toast("Dose change saved");
            setDialog(null);
          }}
        />
      )}

      {dialog?.kind === "history" && (
        <HistoryDialog
          med={dialog.med}
          changes={changesFor(dialog.med.id)}
          nameOf={nameOf}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog && dialog.kind !== "dose" && dialog.kind !== "history" && (
        <PromptDialog
          title={
            dialog.kind === "stopped"
              ? `Stop ${dialog.med.drug}?`
              : `Remove ${dialog.med.drug} as entered in error?`
          }
          message={
            dialog.kind === "stopped"
              ? "It moves to “Stopped / removed medications”. Its full history stays on record."
              : "Use this only for an entry that should never have been made. To end a medication that was given, use Stop instead."
          }
          label={dialog.kind === "stopped" ? "Reason (optional)" : "Reason"}
          required={dialog.kind === "removed"}
          confirmLabel={
            dialog.kind === "stopped" ? "Stop medication" : "Remove entry"
          }
          danger
          busy={busy}
          error={endError}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => void end(dialog.kind, dialog.med, reason)}
        />
      )}
    </section>
  );
}
