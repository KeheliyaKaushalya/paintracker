import { useState, useRef, type ReactNode } from "react";
import type { PatientFull } from "../../../domain/clinical/models";
import {
  todayISO,
  nowHHMM,
  hhmm,
  fmtDateLong,
} from "../../../domain/clinical/dates";
import { effectiveRounds } from "../../../domain/clinical/rounds";
import { RoundItem } from "../../rounds/RoundItem";
import { useMedChanges } from "../hooks";
import PainChart from "../../rounds/PainChart";
import { useAuth } from "../../auth/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../infrastructure/supabase/supabase";
import "./timeline.css";

type Category = "Rounds" | "Medications" | "Events";
type Event = {
  id: string;
  category: Category;
  day: string;
  time: string;
  title: string;
  actor?: string | null;
  detail: ReactNode;
  search?: string;
};
const filters = ["All", "Rounds", "Medications", "Events"] as const;

export function PatientTimeline({
  patient: p,
  nameOf,
}: {
  patient: PatientFull;
  nameOf: (id: string) => string;
}) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const { profile, session } = useAuth();
  const admin = profile?.role === "admin";
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(20);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const host = useRef<HTMLElement>(null);
  const audit = useQuery({
    queryKey: ["timeline-audit", session?.user.id, p.id],
    enabled: admin && !!session,
    queryFn: async () => {
      const rows = [];
      for (let offset = 0; ; offset += 200) {
        const { data, error } = await supabase
          .from("audit_log")
          .select("id,at,actor,action,old_row,new_row")
          .eq("table_name", "patients")
          .eq("row_id", p.id)
          .eq("action", "UPDATE")
          .order("id")
          .range(offset, offset + 199);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 200) return rows;
      }
    },
  });
  const changes = useMedChanges(p.id);
  const events: Event[] = [];
  function add(
    id: string,
    category: Category,
    stamp: string | null,
    title: string,
    detail: ReactNode,
    actor?: string | null,
  ) {
    if (!stamp) return;
    const date = new Date(stamp);
    if (!Number.isFinite(date.getTime())) return;
    events.push({
      id,
      category,
      day: todayISO(date),
      time: nowHHMM(date),
      title,
      detail,
      actor,
      search: typeof detail === "string" ? detail : undefined,
    });
  }
  add(
    "registered",
    "Events",
    p.created_at,
    "Patient registered",
    "Patient record created.",
    p.created_by,
  );
  if (p.discharged_date)
    events.push({
      id: "discharged",
      category: "Events",
      day: p.discharged_date,
      time: "",
      title: "Patient discharged",
      detail:
        "Recorded discharge date. Time and staff attribution are unavailable.",
    });
  for (const r of effectiveRounds(p.rounds)) {
    events.push({
      id: `round-${r.id}`,
      category: "Rounds",
      day: r.round_date,
      time: hhmm(r.round_time),
      title: `${r.kind === "pain" ? "Pain round" : "Ward round"}${
        r.amended_of ? " · Corrected" : ""
      }`,
      actor: r.created_by,
      search: [
        r.note,
        r.session,
        r.mobilization,
        r.tags.join(" "),
        r.pain_rest,
        r.pain_move,
      ].join(" "),
      detail: (
        <RoundItem round={r} all={p.rounds} nameOf={nameOf} canAmend={false} />
      ),
    });
  }
  for (const m of p.patient_meds) {
    add(
      `start-${m.id}`,
      "Medications",
      m.started_at,
      `Medication added: ${m.drug}`,
      "Medication entry created. See dose changes for recorded historical doses.",
      m.started_by,
    );
    add(
      `end-${m.id}`,
      "Medications",
      m.ended_at,
      `${
        m.status === "removed"
          ? "Medication entered in error"
          : "Medication stopped"
      }: ${m.drug}`,
      m.end_reason || "No reason recorded.",
      m.ended_by,
    );
  }
  for (const c of changes.data ?? []) {
    const drug =
      p.patient_meds.find((m) => m.id === c.med_id)?.drug ?? "Medication";
    add(
      `change-${c.id}`,
      "Medications",
      c.changed_at,
      `Dose changed: ${drug}`,
      <>
        {[c.from_dose, c.from_freq].filter(Boolean).join(" ") || "—"} →{" "}
        {[c.to_dose, c.to_freq].filter(Boolean).join(" ") || "—"}
        {c.reason && <p>{c.reason}</p>}
      </>,
      c.changed_by,
    );
  }
  for (const a of p.patient_alerts) {
    add(
      `note-${a.id}`,
      "Events",
      a.created_at,
      "Special note added",
      a.alert_text,
      a.created_by,
    );
    add(
      `resolved-${a.id}`,
      "Events",
      a.resolved_at,
      "Special note resolved",
      a.alert_text,
      a.resolved_by,
    );
  }
  if (admin)
    for (const a of audit.data ?? []) {
      const before = a.old_row as Record<string, unknown> | null;
      const after = a.new_row as Record<string, unknown> | null;
      if (!before || !after) continue;
      if (
        typeof before.ward === "string" &&
        typeof after.ward === "string" &&
        before.ward !== after.ward
      )
        add(
          `transfer-${a.id}`,
          "Events",
          a.at,
          "Ward transfer",
          `${before.ward} → ${after.ward}`,
          a.actor,
        );
      const fields = Object.keys(after).filter(
        (k) =>
          !["updated_at", "ward"].includes(k) &&
          JSON.stringify(before[k]) !== JSON.stringify(after[k]),
      );
      if (fields.length)
        add(
          `audit-${a.id}`,
          "Events",
          a.at,
          "Patient record updated",
          `Changed fields: ${fields.join(", ")}`,
          a.actor,
        );
    }
  const matching = events.filter(
    (e) =>
      (!from || e.day >= from) &&
      (!to || e.day <= to) &&
      [
        e.title,
        e.day,
        e.time,
        e.category,
        e.search,
        e.actor ? nameOf(e.actor) : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const visible = matching
    .filter((e) => filter === "All" || e.category === filter)
    .sort(
      (a, b) =>
        b.day.localeCompare(a.day) ||
        b.time.localeCompare(a.time) ||
        a.id.localeCompare(b.id),
    );
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const page = visible.slice(0, limit);
  const painRounds = effectiveRounds(p.rounds).filter(
    (r) =>
      r.kind === "pain" &&
      (!from || r.round_date >= from) &&
      (!to || r.round_date <= to),
  );
  function expand(open: boolean) {
    host.current
      ?.querySelectorAll<HTMLDetailsElement>("details.timeline-event")
      .forEach((el) => {
        el.open = open;
      });
  }
  async function printTimeline() {
    setExporting(true);
    setExportError("");
    try {
      const { error } = await supabase.rpc("log_export", {
        description: "Patient timeline print requested",
        export_kind: "summary",
        row_count: page.length,
      });
      if (error) throw error;
      const node = host.current;
      if (!node) return;
      const details = Array.from(
        node.querySelectorAll<HTMLDetailsElement>("details.timeline-event"),
      );
      const states = details.map((d) => d.open);
      details.forEach((d) => {
        d.open = true;
      });
      document.body.classList.add("printing-patient-timeline");
      try {
        window.print();
      } finally {
        document.body.classList.remove("printing-patient-timeline");
        details.forEach((d, i) => {
          d.open = states[i];
        });
      }
    } catch (e) {
      setExportError(
        e instanceof Error
          ? e.message
          : "Unable to authorize or print timeline.",
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <section
      ref={host}
      className="patient-timeline stack"
      aria-labelledby="timeline-heading"
    >
      <h2 id="timeline-heading" className="section-title">
        Patient timeline
      </h2>
      <div className="timeline-controls stack">
        <label>
          Search events
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(20);
            }}
          />
        </label>
        <div className="timeline-dates">
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setLimit(20);
              }}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setLimit(20);
              }}
            />
          </label>
        </div>
        {from && to && from > to && (
          <p role="alert">Start date must precede end date.</p>
        )}
        <div className="row wrap">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setSearch("");
              setFrom("");
              setTo("");
              setFilter("All");
              setLimit(20);
            }}
          >
            Clear filters
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => expand(true)}
          >
            Expand all
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => expand(false)}
          >
            Collapse all
          </button>
          {admin && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={
                exporting ||
                !page.length ||
                changes.isPending ||
                changes.isError ||
                audit.isPending ||
                audit.isError
              }
              onClick={() => void printTimeline()}
            >
              Print / Save PDF (shown events)
            </button>
          )}
        </div>
        {exportError && <p role="alert">{exportError}</p>}
      </div>
      <p className="timeline-print-heading">
        {p.full_name} · BHT {p.bht}
      </p>
      {painRounds.length > 0 && (
        <details className="card timeline-chart">
          <summary>Pain score trend (date range)</summary>
          <PainChart rounds={painRounds} />
        </details>
      )}
      {admin && audit.isPending && (
        <p role="status">Loading patient update history…</p>
      )}
      {admin && audit.isError && (
        <p role="alert">
          Patient update history unavailable.{" "}
          <button type="button" onClick={() => void audit.refetch()}>
            Retry
          </button>
        </p>
      )}
      <div
        className="row wrap timeline-controls"
        role="group"
        aria-label="Timeline filter"
      >
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            className={`btn btn-sm ${
              filter === f ? "btn-primary" : "btn-outline"
            }`}
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
              setLimit(20);
            }}
          >
            {f} (
            {matching.filter((e) => f === "All" || e.category === f).length})
          </button>
        ))}
      </div>
      {(filter === "All" || filter === "Medications") && changes.isPending && (
        <p role="status" className="muted">
          Loading dose history…
        </p>
      )}
      {(filter === "All" || filter === "Medications") && changes.isError && (
        <div role="alert" className="error-box">
          Dose history unavailable. Timeline may be incomplete.{" "}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => void changes.refetch()}
          >
            Retry
          </button>
        </div>
      )}
      {visible.length === 0 && (
        <p className="muted">No recorded events in this category.</p>
      )}
      <div className="timeline-stream">
        {page.map((e, i) => (
          <div className="timeline-row" key={e.id}>
            {(i === 0 || visible[i - 1].day !== e.day) && (
              <h3 className="timeline-day">
                {e.day === todayISO()
                  ? "Today"
                  : e.day === todayISO(yesterday)
                  ? "Yesterday"
                  : fmtDateLong(e.day)}
              </h3>
            )}
            <details className="timeline-event">
              <summary>
                <span
                  className="timeline-marker"
                  data-category={e.category}
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {e.category === "Rounds" ? (
                      <>
                        <rect x="5" y="5" width="14" height="16" rx="2" />
                        <rect x="9" y="2" width="6" height="5" rx="1" />
                        <path d="M9 11h6M9 15h6" />
                      </>
                    ) : e.category === "Medications" ? (
                      <>
                        <path
                          d="M8 20a5 5 0 0 1-7-7L12 2a5 5 0 0 1 7 7Z"
                          transform="translate(2 1)"
                        />
                        <path d="m8 9 7 7" />
                      </>
                    ) : (
                      <>
                        <circle cx="12" cy="7" r="4" />
                        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
                      </>
                    )}
                  </svg>
                </span>
                <strong>{e.title}</strong>
                <span className="timeline-meta">
                  {e.day === todayISO()
                    ? "Today"
                    : e.day === todayISO(yesterday)
                    ? "Yesterday"
                    : fmtDateLong(e.day)}{" "}
                  · {e.time || "Time not recorded"}
                  {e.actor && ` · ${nameOf(e.actor)}`}
                </span>
              </summary>
              <div className="timeline-detail">{e.detail}</div>
            </details>
          </div>
        ))}
      </div>
      <p className="muted">
        Showing {page.length} of {visible.length} events
      </p>
      {page.length < visible.length && (
        <button
          type="button"
          className="btn btn-outline timeline-controls"
          onClick={() => setLimit((n) => n + 20)}
        >
          Load more
        </button>
      )}
      <p className="faint">
        Shows available recorded events, not a complete audit history. Events
        without recorded times are listed after timed events on the same day.
      </p>
    </section>
  );
}
