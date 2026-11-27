import { Button } from "../../shared/components/ui";
import { useSubmission } from "../../shared/hooks/useSubmission";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../../shared/components/Icon";
import { useToast } from "../../shared/components/Toast";
import { Field } from "../../shared/components/ui";
import {
  ANAESTHESIA_MODES,
  CATEGORIES,
  EPIDURAL_LEVELS,
  MED_DRUGS,
  MED_FREQS,
  MED_ROUTES,
  NERVE_TYPES,
  SEXES,
  WARDS_DEFAULT,
  NEEDLE_SUGGESTIONS,
  NOTE_CATEGORIES,
  PDPH_TECHNIQUES,
  SPINAL_LEVELS,
} from "../../domain/clinical/constants";
import { friendlyMessage } from "../../shared/errors/errors";
import { useAuth } from "../auth/AuthProvider";
import { createPatient, updatePatient } from "../../app/patientUseCases";
import { useWards } from "./hooks";
import {
  buildPatient,
  newMedRow,
  type MedFormRow,
  type PatientFormValues,
} from "../../domain/patients/schemas";

import { Section, Choice, Toggle, Select } from "./PatientFormControls";

export function PatientForm({
  initial,
  patientId,
  existingMedIds,
}: {
  initial: PatientFormValues;
  patientId?: string;
  existingMedIds: string[];
}) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState<PatientFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, begin, end } = useSubmission();
  const [formError, setFormError] = useState<string | null>(null);
  const wardsQ = useWards();
  const wardNames = wardsQ.data
    ? wardsQ.data.filter((w) => w.active).map((w) => w.name)
    : [...WARDS_DEFAULT];
  const set = <K extends keyof PatientFormValues>(
    k: K,
    v: PatientFormValues[K],
  ) => setF((cur) => ({ ...cur, [k]: v }));
  const setMed = (id: string, patch: Partial<MedFormRow>) =>
    setF((cur) => ({
      ...cur,
      meds: cur.meds.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  const err = (k: string) => errors[k];
  const bad = (k: string) => (errors[k] ? true : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const built = buildPatient(f);
    if (!built.ok) {
      setErrors(built.errors);
      setFormError(
        `Please fix ${
          Object.keys(built.errors).length === 1
            ? "the highlighted field"
            : "the highlighted fields"
        } and try again.`,
      );
      requestAnimationFrame(() =>
        document
          .querySelector('[aria-invalid="true"], .field-error')
          ?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      return;
    }
    setErrors({});
    if (!session) return;
    if (!begin()) return;
    try {
      const out = patientId
        ? await updatePatient(patientId, built.value, existingMedIds)
        : await createPatient(built.value, session.user.id);
      await qc.invalidateQueries();
      if (out.warnings.length) toast(out.warnings[0], "error");
      else toast(patientId ? "Patient updated" : "Patient added");
      navigate(`/patients/${out.id}`);
    } catch (ex) {
      setFormError(ex instanceof Error ? ex.message : friendlyMessage(null));
    } finally {
      end();
    }
  }

  return (
    <form onSubmit={submit} noValidate className="stack">
      <div className="row between">
        <Link
          to={patientId ? `/patients/${patientId}` : "/"}
          className="btn btn-ghost btn-sm"
        >
          <Icon name="back" />
          Cancel
        </Link>
        <h1 style={{ fontSize: 20 }}>
          {patientId ? "Edit patient" : "New patient"}
        </h1>
      </div>

      <Section title="Patient" open>
        <Field id="full_name" label="Full name" error={err("full_name")}>
          <input
            id="full_name"
            className="input"
            autoComplete="off"
            autoCapitalize="words"
            aria-invalid={bad("full_name")}
            value={f.full_name}
            onChange={(e) => set("full_name", e.target.value)}
          />
        </Field>
        <div className="row3">
          <Field id="age" label="Age" error={err("age")}>
            <input
              id="age"
              className="input"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              aria-invalid={bad("age")}
              value={f.age}
              onChange={(e) => set("age", e.target.value)}
            />
          </Field>
          <Field id="sex" label="Sex">
            <select
              id="sex"
              className="input"
              value={f.sex}
              onChange={(e) => set("sex", e.target.value)}
            >
              <option value="">—</option>
              {SEXES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field id="bht" label="BHT number" error={err("bht")}>
            <input
              id="bht"
              className="input"
              autoComplete="off"
              aria-invalid={bad("bht")}
              value={f.bht}
              onChange={(e) => set("bht", e.target.value)}
            />
          </Field>
        </div>
        <Field id="ward" label="Ward" error={err("ward")}>
          <input
            id="ward"
            className="input"
            list="wards"
            autoComplete="off"
            aria-invalid={bad("ward")}
            value={f.ward}
            onChange={(e) => set("ward", e.target.value)}
          />
          <datalist id="wards">
            {wardNames.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
        </Field>
      </Section>

      <Section title="Patient category">
        <Choice
          label="Category"
          value={f.category}
          options={CATEGORIES}
          onChange={(v) => set("category", v || "Surgery")}
        />
        {(NOTE_CATEGORIES as readonly string[]).includes(f.category) && (
          <Field
            id="category_note"
            label="Details"
            error={err("category_note")}
          >
            <textarea
              id="category_note"
              className="input"
              value={f.category_note}
              onChange={(e) => set("category_note", e.target.value)}
            />
          </Field>
        )}
      </Section>

      <Section title="Surgery">
        <Field id="surgery" label="Surgery" error={err("surgery")}>
          <input
            id="surgery"
            className="input"
            autoComplete="off"
            value={f.surgery}
            onChange={(e) => set("surgery", e.target.value)}
          />
        </Field>
        <Field id="indication" label="Indication" error={err("indication")}>
          <input
            id="indication"
            className="input"
            autoComplete="off"
            value={f.indication}
            onChange={(e) => set("indication", e.target.value)}
          />
        </Field>
        <div className="row2">
          <Field
            id="surgery_date"
            label="Surgery date"
            error={err("surgery_date")}
          >
            <input
              id="surgery_date"
              className="input"
              type="date"
              value={f.surgery_date}
              onChange={(e) => set("surgery_date", e.target.value)}
            />
          </Field>
          <Field id="surgery_time" label="Time" error={err("surgery_time")}>
            <input
              id="surgery_time"
              className="input"
              type="time"
              value={f.surgery_time}
              onChange={(e) => set("surgery_time", e.target.value)}
            />
          </Field>
        </div>
        <Choice
          label="Anaesthesia"
          value={f.anaesthesia_mode}
          options={ANAESTHESIA_MODES}
          onChange={(v) => set("anaesthesia_mode", v)}
        />
      </Section>

      {f.category === "PDPH" && (
        <Section title="Post-dural puncture headache (PDPH)" open>
          <Choice
            label="Technique"
            value={f.anaesthesia_mode}
            options={PDPH_TECHNIQUES}
            onChange={(v) => set("anaesthesia_mode", v)}
          />
          {f.anaesthesia_mode !== "Spinal" && f.anaesthesia_mode !== "CSE" && (
            <span className="hint">
              Choose the technique used for the dural puncture.
            </span>
          )}
          <div className="row2">
            <Field id="pdph_level" label="Level" error={err("pdph_level")}>
              <input
                id="pdph_level"
                className="input"
                list="pdph-levels"
                autoComplete="off"
                placeholder="e.g. L3-L4"
                value={f.pdph_level}
                onChange={(e) => set("pdph_level", e.target.value)}
              />
              <datalist id="pdph-levels">
                {SPINAL_LEVELS.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </Field>
            <Field
              id="pdph_needle"
              label="Needle used"
              error={err("pdph_needle")}
            >
              <input
                id="pdph_needle"
                className="input"
                list="pdph-needles"
                autoComplete="off"
                placeholder="e.g. 25G Whitacre"
                value={f.pdph_needle}
                onChange={(e) => set("pdph_needle", e.target.value)}
              />
              <datalist id="pdph-needles">
                {NEEDLE_SUGGESTIONS.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
          </div>
          <Field
            id="pdph_attempts"
            label="Number of attempts"
            error={err("pdph_attempts")}
          >
            <input
              id="pdph_attempts"
              className="input"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              aria-invalid={bad("pdph_attempts")}
              placeholder="e.g. 2"
              value={f.pdph_attempts}
              onChange={(e) => set("pdph_attempts", e.target.value)}
            />
          </Field>
          <Field
            id="pdph_symptoms"
            label="Symptoms"
            error={err("pdph_symptoms")}
          >
            <textarea
              id="pdph_symptoms"
              className="input"
              placeholder="e.g. postural headache, neck stiffness, nausea"
              value={f.pdph_symptoms}
              onChange={(e) => set("pdph_symptoms", e.target.value)}
            />
          </Field>
          <Field
            id="pdph_complaint"
            label="Presenting complaint"
            error={err("pdph_complaint")}
          >
            <textarea
              id="pdph_complaint"
              className="input"
              placeholder="Why the patient was referred / what they complained of"
              value={f.pdph_complaint}
              onChange={(e) => set("pdph_complaint", e.target.value)}
            />
          </Field>
          <Field
            id="pdph_condition"
            label="Current condition"
            error={err("pdph_condition")}
          >
            <textarea
              id="pdph_condition"
              className="input"
              placeholder="Current status on review"
              value={f.pdph_condition}
              onChange={(e) => set("pdph_condition", e.target.value)}
            />
          </Field>
          <Field
            id="pdph_management"
            label="Management"
            error={err("pdph_management")}
          >
            <textarea
              id="pdph_management"
              className="input"
              placeholder="Treatment given / plan"
              value={f.pdph_management}
              onChange={(e) => set("pdph_management", e.target.value)}
            />
          </Field>
        </Section>
      )}

      <Section
        title="Pain management"
        open={
          f.has_epidural ||
          f.has_nerve_catheter ||
          f.has_pca ||
          f.meds.length > 0 ||
          f.category === "PDPH" ||
          f.category === "Rib fracture"
        }
      >
        <div className="stack-s">
          <span className="label">Techniques in use</span>
          <div className="chips">
            <Toggle
              label="Epidural"
              on={f.has_epidural}
              onChange={(v) => set("has_epidural", v)}
            />
            <Toggle
              label="Nerve catheter"
              on={f.has_nerve_catheter}
              onChange={(v) => set("has_nerve_catheter", v)}
            />
            <Toggle
              label="PCA"
              on={f.has_pca}
              onChange={(v) => set("has_pca", v)}
            />
          </div>
        </div>

        {f.has_epidural && (
          <div className="med-card">
            <strong>Epidural</strong>
            <Field
              id="ep_level"
              label="Level (for example T11-T12)"
              error={err("ep_level")}
            >
              <input
                id="ep_level"
                className="input"
                list="levels"
                autoComplete="off"
                aria-invalid={bad("ep_level")}
                value={f.ep_level}
                onChange={(e) => set("ep_level", e.target.value)}
              />
              <datalist id="levels">
                {EPIDURAL_LEVELS.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </Field>
            <div className="row2">
              <Field id="ep_d" label="Inserted (date)">
                <input
                  id="ep_d"
                  className="input"
                  type="date"
                  value={f.ep_inserted_date}
                  onChange={(e) => set("ep_inserted_date", e.target.value)}
                />
              </Field>
              <Field id="ep_t" label="Time">
                <input
                  id="ep_t"
                  className="input"
                  type="time"
                  value={f.ep_inserted_time}
                  onChange={(e) => set("ep_inserted_time", e.target.value)}
                />
              </Field>
            </div>
            <Field id="ep_dose" label="Test / top-up dose">
              <input
                id="ep_dose"
                className="input"
                autoComplete="off"
                value={f.ep_test_dose}
                onChange={(e) => set("ep_test_dose", e.target.value)}
              />
            </Field>
          </div>
        )}

        {f.has_nerve_catheter && (
          <div className="med-card">
            <strong>Nerve catheter</strong>
            <Select
              id="nv_type"
              label="Type"
              value={f.nv_type}
              options={NERVE_TYPES}
              onChange={(v) => set("nv_type", v)}
            />
            <div className="row2">
              <Field id="nv_d" label="Inserted (date)">
                <input
                  id="nv_d"
                  className="input"
                  type="date"
                  value={f.nv_inserted_date}
                  onChange={(e) => set("nv_inserted_date", e.target.value)}
                />
              </Field>
              <Field id="nv_t" label="Time">
                <input
                  id="nv_t"
                  className="input"
                  type="time"
                  value={f.nv_inserted_time}
                  onChange={(e) => set("nv_inserted_time", e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {f.has_pca && (
          <div className="med-card">
            <strong>PCA</strong>
            <Field id="pca_drug" label="Drug">
              <input
                id="pca_drug"
                className="input"
                autoComplete="off"
                value={f.pca_drug}
                onChange={(e) => set("pca_drug", e.target.value)}
              />
            </Field>
            <div className="row3">
              <Field id="pca_bolus" label="Bolus">
                <input
                  id="pca_bolus"
                  className="input"
                  autoComplete="off"
                  value={f.pca_bolus}
                  onChange={(e) => set("pca_bolus", e.target.value)}
                />
              </Field>
              <Field id="pca_lock" label="Lockout">
                <input
                  id="pca_lock"
                  className="input"
                  autoComplete="off"
                  value={f.pca_lockout}
                  onChange={(e) => set("pca_lockout", e.target.value)}
                />
              </Field>
              <Field id="pca_max" label="Max / hr">
                <input
                  id="pca_max"
                  className="input"
                  autoComplete="off"
                  value={f.pca_max_hr}
                  onChange={(e) => set("pca_max_hr", e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        <div className="stack-s">
          <span className="label">Medications</span>
          {f.meds.map((m, i) => {
            if (existingMedIds.includes(m.id)) {
              return (
                <div className="med-card" key={m.id} data-testid="med-row">
                  <strong>{m.drug}</strong>
                  <span className="muted">
                    {[
                      m.route,
                      m.dose,
                      m.freq === "Other" ? m.freq_custom : m.freq,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="hint">
                    Saved medication. To change the dose or stop it, use the
                    patient page.
                  </span>
                </div>
              );
            }
            return (
              <div className="med-card" key={m.id} data-testid="med-row">
                <div className="row2">
                  <Select
                    id={`d${m.id}`}
                    label="Drug"
                    value={m.drug}
                    options={MED_DRUGS}
                    onChange={(v) => setMed(m.id, { drug: v })}
                  />
                  <Select
                    id={`r${m.id}`}
                    label="Route"
                    value={m.route}
                    options={MED_ROUTES}
                    onChange={(v) => setMed(m.id, { route: v })}
                  />
                </div>
                <div className="row2">
                  <Field id={`o${m.id}`} label="Dose">
                    <input
                      id={`o${m.id}`}
                      className="input"
                      autoComplete="off"
                      value={m.dose}
                      onChange={(e) => setMed(m.id, { dose: e.target.value })}
                    />
                  </Field>
                  <Field id={`f${m.id}`} label="Frequency">
                    <select
                      id={`f${m.id}`}
                      className="input"
                      value={m.freq}
                      onChange={(e) => setMed(m.id, { freq: e.target.value })}
                    >
                      <option value="">—</option>
                      {MED_FREQS.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {m.freq === "Other" && (
                  <Field id={`c${m.id}`} label="Frequency (describe)">
                    <input
                      id={`c${m.id}`}
                      className="input"
                      value={m.freq_custom}
                      onChange={(e) =>
                        setMed(m.id, { freq_custom: e.target.value })
                      }
                    />
                  </Field>
                )}
                <div className="segmented" role="group" aria-label="Dosing">
                  <button
                    type="button"
                    className={m.dosing === "single" ? "active" : ""}
                    aria-pressed={m.dosing === "single"}
                    onClick={() => setMed(m.id, { dosing: "single" })}
                  >
                    Single dose
                  </button>
                  <button
                    type="button"
                    className={m.dosing === "loading" ? "active" : ""}
                    aria-pressed={m.dosing === "loading"}
                    onClick={() => setMed(m.id, { dosing: "loading" })}
                  >
                    Loading + top-up
                  </button>
                </div>
                {m.dosing === "loading" && (
                  <Field id={`t${m.id}`} label="Top-up dose">
                    <input
                      id={`t${m.id}`}
                      className="input"
                      autoComplete="off"
                      value={m.topup}
                      onChange={(e) => setMed(m.id, { topup: e.target.value })}
                    />
                  </Field>
                )}
                {err(`med_${i}`) && (
                  <span className="field-error" role="alert">
                    {err(`med_${i}`)}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() =>
                    set(
                      "meds",
                      f.meds.filter((x) => x.id !== m.id),
                    )
                  }
                >
                  <Icon name="trash" />
                  Remove medication
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => set("meds", [...f.meds, newMedRow()])}
          >
            <Icon name="plus" />
            Add medication
          </button>
        </div>
      </Section>

      {!patientId && (
        <Section title="Alert (optional)">
          <Field
            id="new_alert"
            label="Special note or alert"
            error={err("new_alert")}
            hint="Shown in red on the patient's card. It cannot be edited later, only added to."
          >
            <textarea
              id="new_alert"
              className="input"
              value={f.new_alert}
              onChange={(e) => set("new_alert", e.target.value)}
            />
          </Field>
        </Section>
      )}

      {formError && (
        <div className="error-box" role="alert">
          {formError}
        </div>
      )}
      <div className="sticky-actions">
        <Button className="btn btn-primary grow" type="submit" disabled={busy}>
          {busy ? "Saving…" : patientId ? "Save changes" : "Add patient"}
        </Button>
      </div>
    </form>
  );
}
