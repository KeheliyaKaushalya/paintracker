import { useState } from "react";
import { Link } from "react-router-dom";
import { usePatients, useNameLookup } from "../patients/hooks";
import { PatientCard } from "../patients/PatientCard";
import { ShiftStrip } from "../shifts/ShiftStrip";
import { Empty, ErrorBox, Spinner } from "../../shared/components/ui";
import { todayISO } from "../../domain/clinical/dates";
import { dashboardGroups } from "./metrics";
import { sortBoard } from "../patients/filters";
import "./dashboard.css";

const metrics = [
  ["all", "Active patients"],
  ["attention", "Requires review"],
  ["severe", "Latest severe pain"],
  ["alerts", "Open alerts"],
  ["assessed", "Pain assessed today"],
  ["notAssessed", "No pain assessment today"],
] as const;
type Group = typeof metrics[number][0];

export default function ClinicalDashboardPage() {
  const q = usePatients("active");
  const nameOf = useNameLookup();
  const [ward, setWard] = useState("");
  const [group, setGroup] = useState<Group>("attention");
  const patients = q.data ?? [];
  const wards = [...new Set(patients.map(p => p.ward))].sort();
  const groups = dashboardGroups(patients.filter(p => !ward || p.ward === ward), todayISO());
  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Clinical Dashboard</h1><p className="muted">Clinical operations and follow-up</p></div>
        <button type="button" className="btn btn-outline btn-sm" disabled={q.isFetching} onClick={() => void q.refetch()}>Refresh</button>
      </div>
      <ShiftStrip />
      <div className="row wrap">
        <Link className="btn btn-primary" to="/patients/new">New Patient</Link>
        <Link className="btn btn-outline" to="/rounds">Start Rounds</Link>
        <Link className="btn btn-outline" to="/">Find Patient</Link>
        <Link className="btn btn-outline" to="/shifts">Shifts</Link>
      </div>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && !q.error && <>
        <p className="muted">Latest available records · {new Date(q.dataUpdatedAt).toLocaleString()}</p>
        <div className="field">
          <label htmlFor="dashboard-ward">Ward</label>
          <select id="dashboard-ward" className="input" value={ward} onChange={e => setWard(e.target.value)}>
            <option value="">All wards</option>
            {wards.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div className="dashboard-metrics">
          {metrics.map(([key, label]) => <button type="button" key={key} className="card dashboard-metric" aria-pressed={group === key} onClick={() => setGroup(key)}>
            <span>{label}</span><strong>{groups[key].length}</strong>
          </button>)}
        </div>
        <p className="muted">No assessment today does not necessarily mean a round is overdue. Review assessment dates before acting.</p>
        <h2 className="section-title">{metrics.find(([key]) => key === group)?.[1]}</h2>
        {groups[group].length === 0 && <Empty title="No matching patients">No patients match this view in the available records.</Empty>}
        {sortBoard(groups[group]).map(p => <div key={p.id} className="stack-s">
          <PatientCard patient={p} nameOf={nameOf} />
          <div className="row wrap">
            <Link className="btn btn-primary grow" to={`/patients/${p.id}/round?kind=pain`}>Pain Round</Link>
            <Link className="btn btn-outline grow" to={`/patients/${p.id}/round?kind=ward`}>Ward Round</Link>
          </div>
        </div>)}
      </>}
    </div>
  );
}
