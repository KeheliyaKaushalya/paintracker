import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "../../shared/components/Toast";
import { Empty, ErrorBox, Spinner } from "../../shared/components/ui";
import { fmtDate, hhmm, todayISO } from "../../domain/clinical/dates";
import type {
  ShiftAssignment,
  ShiftTemplate,
} from "../../domain/clinical/models";
import { addDays } from "../../domain/clinical/shifts";
import { useProfiles } from "../patients/hooks";
import { saveShiftAssignment } from "../../infrastructure/repositories/shifts";
import { useShiftAssignments, useShiftTemplates } from "./hooks";

function ReminderButton() {
  const supported = typeof Notification !== "undefined";
  const [perm, setPerm] = useState<NotificationPermission>(
    supported ? Notification.permission : "denied",
  );
  if (!supported)
    return (
      <p className="hint">This browser does not support shift reminders.</p>
    );
  if (perm === "granted")
    return (
      <p className="hint">
        Shift reminders are on. They appear only while the app is open.
      </p>
    );
  if (perm === "denied")
    return (
      <p className="hint">
        Shift reminders are blocked in this browser&apos;s settings.
      </p>
    );
  return (
    <button
      className="btn btn-outline btn-sm"
      onClick={() => void Notification.requestPermission().then(setPerm)}
    >
      Turn on shift reminders
    </button>
  );
}

function ShiftRow({
  date,
  template,
  current,
}: {
  date: string;
  template: ShiftTemplate;
  current?: ShiftAssignment;
}) {
  const profiles = useProfiles();
  const qc = useQueryClient();
  const toast = useToast();
  const [sel, setSel] = useState(
    current?.assignee_id ?? (current?.assignee_name ? "__other" : ""),
  );
  const [other, setOther] = useState(current?.assignee_name ?? "");
  const [note, setNote] = useState(current?.note ?? "");
  const [busy, setBusy] = useState(false);
  const staff = (profiles.data ?? []).filter((p) => p.active);
  const id = `${date}-${template.id}`;

  async function save() {
    if (sel === "__other" && !other.trim()) {
      toast("Enter the staff member’s name", "error");
      return;
    }
    setBusy(true);
    try {
      await saveShiftAssignment({
        shift_date: date,
        template_id: template.id,
        assignee_id: sel && sel !== "__other" ? sel : null,
        assignee_name: sel === "__other" ? other.trim() : null,
        note: note.trim() || null,
      });
      await qc.invalidateQueries({ queryKey: ["shifts"] });
      toast("Shift saved");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Could not save the shift",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="stack-s"
      style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}
    >
      <strong>
        {template.name}{" "}
        <span className="faint">
          {hhmm(template.start_time)}–{hhmm(template.end_time)}
        </span>
      </strong>
      <label className="sr-only" htmlFor={`sel-${id}`}>
        Who is on the {template.name} shift
      </label>
      <select
        id={`sel-${id}`}
        className="input"
        value={sel}
        onChange={(e) => setSel(e.target.value)}
      >
        <option value="">Unassigned</option>
        {staff.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name || "Unnamed user"}
          </option>
        ))}
        <option value="__other">Someone else (type a name)</option>
      </select>
      {sel === "__other" && (
        <input
          className="input"
          aria-label="Name of the person on this shift"
          placeholder="Name"
          value={other}
          onChange={(e) => setOther(e.target.value)}
        />
      )}
      <input
        className="input"
        aria-label="Note for this shift"
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        className="btn btn-primary btn-sm"
        style={{ alignSelf: "flex-start" }}
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

export function ShiftsPage() {
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const templates = useShiftTemplates();
  const assignments = useShiftAssignments(days[0], days[6]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Shifts</h1>
          <p className="muted">
            Who is on duty for the next 7 days. Anyone can assign a shift.
          </p>
        </div>
      </div>
      <ReminderButton />
      {(templates.isLoading || assignments.isLoading) && <Spinner />}
      {templates.error && (
        <ErrorBox
          error={templates.error}
          onRetry={() => void templates.refetch()}
        />
      )}
      {templates.data && templates.data.length === 0 && (
        <Empty title="No shifts set up">
          An administrator can add shift times on the Team page.
        </Empty>
      )}
      {templates.data &&
        days.map((d) => (
          <section key={d}>
            <h2 className="section-title">
              {d === today ? "Today" : fmtDate(d)}
            </h2>
            <div className="card">
              {templates.data.map((t) => {
                const a = (assignments.data ?? []).find(
                  (x) => x.shift_date === d && x.template_id === t.id,
                );
                // the key makes the row reset when someone else changes it
                return (
                  <ShiftRow
                    key={`${d}-${t.id}-${a?.updated_at ?? "none"}`}
                    date={d}
                    template={t}
                    current={a}
                  />
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}
