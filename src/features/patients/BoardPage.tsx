import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Empty, ErrorBox, Spinner } from "../../shared/components/ui";
import { Icon } from "../../shared/components/Icon";
import { CATEGORIES } from "../../domain/clinical/constants";
import {
  categoryCounts,
  emptyFilters,
  filterPatients,
  sortBoard,
  type BoardFilters,
} from "./filters";
import { useNameLookup, usePatients } from "./hooks";
import { PatientCard } from "./PatientCard";
import { unseenCount } from "../../domain/clinical/alerts";
import { useAuth } from "../auth/AuthProvider";
import { ShiftStrip } from "../shifts/ShiftStrip";

export function BoardPage({
  mode = "patients",
}: {
  mode?: "patients" | "rounds";
}) {
  const roundsMode = mode === "rounds";
  const q = usePatients("active");
  const nameOf = useNameLookup();
  const { session } = useAuth();
  const [f, setF] = useState<BoardFilters>(emptyFilters);
  const patients = q.data;
  const counts = useMemo(() => categoryCounts(patients ?? []), [patients]);
  const unseen = useMemo(
    () => (session ? unseenCount(patients ?? [], session.user.id) : 0),
    [patients, session],
  );
  const wards = useMemo(
    () => [...new Set((patients ?? []).map((p) => p.ward))].sort(),
    [patients],
  );
  const shown = useMemo(
    () => sortBoard(filterPatients(patients ?? [], f)),
    [patients, f],
  );
  const set = (patch: Partial<BoardFilters>) =>
    setF((cur) => ({ ...cur, ...patch }));
  const filtering =
    f.search || f.ward || f.from || f.to || f.category !== "All";

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{roundsMode ? "Rounds" : "Patients"}</h1>
          <p className="muted">
            {patients
              ? `${patients.length} active patients under pain follow-up`
              : "Loading…"}
          </p>
        </div>
      </div>

      {unseen > 0 && (
        <div className="banner banner-warn" role="status">
          <span>
            {unseen === 1 ? "1 patient has" : `${unseen} patients have`} alerts
            you have not acknowledged.
          </span>
        </div>
      )}
      <ShiftStrip />
      <div className="cat-tabs" role="tablist" aria-label="Patient category">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={f.category === c}
            className={`cat-tab ${f.category === c ? "active" : ""}`}
            onClick={() => set({ category: c })}
          >
            {c}
            <span className="count">{counts[c] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="field" style={{ position: "relative" }}>
        <label htmlFor="search" className="sr-only">
          Search by name or BHT
        </label>
        <span
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            color: "var(--ink-faint)",
          }}
        >
          <Icon name="search" />
        </span>
        <input
          id="search"
          className="input"
          style={{ paddingLeft: 40 }}
          type="search"
          placeholder="Search name or BHT"
          value={f.search}
          onChange={(e) => set({ search: e.target.value })}
        />
      </div>

      <div className="filters">
        <div className="field ward-f">
          <label htmlFor="ward">Ward</label>
          <select
            id="ward"
            className="input"
            value={f.ward}
            onChange={(e) => set({ ward: e.target.value })}
          >
            <option value="">All wards</option>
            {wards.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="from">Surgery from</label>
          <input
            id="from"
            className="input"
            type="date"
            value={f.from}
            onChange={(e) => set({ from: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="to">to</label>
          <input
            id="to"
            className="input"
            type="date"
            value={f.to}
            onChange={(e) => set({ to: e.target.value })}
          />
        </div>
      </div>
      {filtering && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setF(emptyFilters)}
          style={{ marginBottom: 8 }}
        >
          Clear filters
        </button>
      )}

      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => void q.refetch()} />}
      {patients && shown.length === 0 && (
        <Empty
          title={
            patients.length === 0
              ? "No active patients"
              : "No patients match these filters"
          }
        >
          {patients.length === 0
            ? "Add the first patient from the Patients tab."
            : "Clear the filters to see everyone."}
        </Empty>
      )}
      {shown.map((p) => (
        <div key={p.id} className={roundsMode ? "round-board-item" : undefined}>
          <PatientCard patient={p} nameOf={nameOf} />
          {roundsMode && (
            <div className="row round-board-actions">
              <Link
                to={`/patients/${p.id}/round?kind=pain`}
                className="btn btn-primary grow"
                aria-label={`Pain Round for ${p.full_name}`}
              >
                Pain Round
              </Link>
              <Link
                to={`/patients/${p.id}/round?kind=ward`}
                className="btn btn-outline grow"
                aria-label={`Ward Round for ${p.full_name}`}
              >
                Ward Round
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
