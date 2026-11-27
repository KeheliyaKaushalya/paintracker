import { useState } from "react";
import { useSubmission } from "../../shared/hooks/useSubmission";
import { Field, Button } from "../../shared/components/ui";
import { MED_FREQS } from "../../domain/clinical/constants";
import type { NewMed } from "../../infrastructure/repositories/patients";

const DRUGS = [
  "Paracetamol",
  "Tramadol",
  "Morphine",
  "Diclofenac",
  "Ibuprofen",
  "Gabapentin",
  "Pregabalin",
  "Amitriptyline",
  "Ondansetron",
  "Omeprazole",
];
const ROUTES = ["Oral", "IV", "IM", "SC", "PR", "Topical", "Epidural"];

export function AddMedForm({ onAdd }: { onAdd: (m: NewMed) => Promise<void> }) {
  const [drugSel, setDrugSel] = useState(DRUGS[0]);
  const [drugOther, setDrugOther] = useState("");
  const [route, setRoute] = useState("Oral");
  const [dose, setDose] = useState("");
  const [freq, setFreq] = useState<string>(MED_FREQS[0]);
  const [custom, setCustom] = useState("");
  const [topup, setTopup] = useState("");
  const { busy, begin, end } = useSubmission();
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const drug = drugSel === "Other" ? drugOther.trim() : drugSel;
    if (!drug) {
      setError("Enter the drug name");
      return;
    }
    if (!dose.trim()) {
      setError("Enter a dose (e.g. 1 g)");
      return;
    }
    if (freq === "Other" && !custom.trim()) {
      setError("Enter the custom frequency");
      return;
    }
    if (!begin()) return;
    try {
      await onAdd({
        drug,
        route,
        dose: dose.trim(),
        freq,
        freq_custom: custom.trim(),
        topup: topup.trim(),
      });
      setDose("");
      setCustom("");
      setTopup("");
      setDrugOther("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the medication");
    } finally {
      end();
    }
  }

  return (
    <div className="med-add">
      <h3 className="med-add-title">Add medication</h3>
      <div className="med-add-grid">
        <Field id="am-drug" label="Medication">
          <select
            id="am-drug"
            className="input"
            value={drugSel}
            onChange={(e) => setDrugSel(e.target.value)}
          >
            {DRUGS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            <option value="Other">Other…</option>
          </select>
        </Field>
        <Field id="am-route" label="Route">
          <select
            id="am-route"
            className="input"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
          >
            {ROUTES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>

        {drugSel === "Other" && (
          <div className="med-add-full">
            <Field id="am-drug-other" label="Drug name">
              <input
                id="am-drug-other"
                className="input"
                autoComplete="off"
                value={drugOther}
                onChange={(e) => setDrugOther(e.target.value)}
              />
            </Field>
          </div>
        )}

        <Field id="am-dose" label="Dose">
          <input
            id="am-dose"
            className="input"
            autoComplete="off"
            placeholder="e.g. 1 g"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
          />
        </Field>
        <Field id="am-freq" label="Frequency">
          <select
            id="am-freq"
            className="input"
            value={freq}
            onChange={(e) => setFreq(e.target.value)}
          >
            {MED_FREQS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>

        {freq === "Other" && (
          <div className="med-add-full">
            <Field id="am-custom" label="Frequency (describe)">
              <input
                id="am-custom"
                className="input"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="med-add-full">
          <Field id="am-topup" label="Top-up (optional)">
            <input
              id="am-topup"
              className="input"
              autoComplete="off"
              placeholder="e.g. 500 mg PRN"
              value={topup}
              onChange={(e) => setTopup(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <Button
        className="btn btn-primary med-add-btn"
        onClick={() => void submit()}
        disabled={busy}
      >
        {busy ? "Adding…" : "Add to chart"}
      </Button>
    </div>
  );
}
