import { useState } from "react";
import { useSubmission } from "../../shared/hooks/useSubmission";
import { Field, Button, useDialogKeyboard } from "../../shared/components/ui";
import { MED_FREQS } from "../../domain/clinical/constants";
import { medFreqLabel } from "../../domain/clinical/meds";
import type { PatientMed } from "../../domain/clinical/models";
import { changeMedDose } from "../../infrastructure/repositories/patients";

export function ChangeDoseDialog({
  med,
  onClose,
  onDone,
}: {
  med: PatientMed;
  onClose: () => void;
  onDone: () => void;
}) {
  const [dose, setDose] = useState(med.dose ?? "");
  const [freq, setFreq] = useState(med.freq ?? "");
  const [custom, setCustom] = useState(med.freq_custom ?? "");
  const [reason, setReason] = useState("");
  const { busy, begin, end } = useSubmission();
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useDialogKeyboard(busy, onClose);

  async function save() {
    setError(null);
    if (freq === "Other" && !custom.trim()) {
      setError("Enter the custom frequency");
      return;
    }
    if (
      dose.trim() === (med.dose ?? "") &&
      freq === (med.freq ?? "") &&
      (freq !== "Other" || custom.trim() === (med.freq_custom ?? ""))
    ) {
      setError("Nothing has changed");
      return;
    }
    if (!begin()) return;
    try {
      await changeMedDose(med.id, dose, freq, custom, reason);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the change");
    } finally {
      end();
    }
  }

  return (
    <div className="dialog-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div
        className="dialog"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-t"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cd-t">Change dose: {med.drug}</h2>
        <p className="muted">
          Currently{" "}
          {[med.route, med.dose, medFreqLabel(med)].filter(Boolean).join(" · ")}
          . The old dose stays in the history.
        </p>
        <Field id="cd-dose" label="New dose">
          <input
            id="cd-dose"
            className="input"
            autoComplete="off"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
          />
        </Field>
        <Field id="cd-freq" label="Frequency">
          <select
            id="cd-freq"
            className="input"
            value={freq}
            onChange={(e) => setFreq(e.target.value)}
          >
            <option value="">—</option>
            {MED_FREQS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>
        {freq === "Other" && (
          <Field id="cd-custom" label="Frequency (describe)">
            <input
              id="cd-custom"
              className="input"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </Field>
        )}
        <Field id="cd-reason" label="Reason (optional)">
          <input
            id="cd-reason"
            className="input"
            autoComplete="off"
            placeholder="e.g. Pain not controlled"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save change"}
          </Button>
        </div>
      </div>
    </div>
  );
}
