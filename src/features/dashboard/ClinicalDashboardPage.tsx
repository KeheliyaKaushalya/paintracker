import { useState } from "react";
import { Link } from "react-router-dom";
import { usePatients, useNameLookup } from "../patients/hooks";
import { PatientCard } from "../patients/PatientCard";
import { ShiftStrip } from "../shifts/ShiftStrip";
import { Empty, ErrorBox, Spinner } from "../../shared/components/ui";
import { todayISO } from "../../domain/clinical/dates";
import { dashboardGroups } from "./metrics";
import { Analytics, reportRows } from "./analytics";
import { useAuth } from "../auth/AuthProvider";
import { useOutboxItems } from "../../shared/components/background";
import { useToast } from "../../shared/components/Toast";
import { supabase } from "../../infrastructure/supabase/supabase";
import { download, toCsv } from "../../infrastructure/platform/export";
import "./dashboard.css";

const metrics = [
  ["all", "Active patients"],
  ["attention", "Requires review"],
  ["severe", "Latest severe pain"],
  ["alerts", "Open alerts"],
  ["epidural", "Recorded epidurals"],
  ["medications", "Patients on active medications"],
  ["assessed", "Pain assessed today"],
  ["notAssessed", "No pain assessment today"],
] as const;
type Group = typeof metrics[number][0];

export default function ClinicalDashboardPage() {
  const q = usePatients("active");
  const {profile,session} = useAuth();
  const pending = useOutboxItems(session?.user.id);
  const toast = useToast();
  const [exporting,setExporting] = useState(false);
  const [category,setCategory] = useState("");
  const [limit,setLimit] = useState(20);
  const nameOf = useNameLookup();
  const [ward, setWard] = useState("");
  const [group, setGroup] = useState<Group>("attention");
  const patients = q.data ?? [];
  const wards = [...new Set(patients.map(p => p.ward))].sort();
  const date = todayISO();
  const selected = patients.filter(p => (!ward || p.ward === ward) && (!category || p.category === category));
  const groups = dashboardGroups(selected, date);
  async function exportReport(kind: "csv" | "pdf") {
    if (profile?.role !== "admin" || exporting || q.error || !q.data) return;
    setExporting(true);
    try {
      const rows = reportRows(selected,date,ward);
      rows.splice(2,0,["Category",category || "All categories"],["Query updated",new Date(q.dataUpdatedAt).toISOString()],["Pending local entries",pending.length]);
      const {error} = await supabase.rpc("log_export", {description:`Dashboard aggregate ${kind}`,export_kind:kind === "csv" ? "wards" : "summary",row_count:selected.length});
      if(error) throw new Error(error.message);
      if(kind === "csv") download(`dashboard-${date}.csv`,toCsv(rows),"text/csv;charset=utf-8");
      else {
        const frame=document.createElement("iframe");
        frame.style.cssText="position:fixed;width:0;height:0;border:0";
        document.body.append(frame);
        const doc=frame.contentDocument;
        if(!doc || !frame.contentWindow){frame.remove();throw new Error("Print unavailable");}
        doc.title="Clinical dashboard";
        const table=doc.createElement("table");
        table.style.cssText="border-collapse:collapse;font:12px sans-serif";
        for(const row of rows){const tr=table.insertRow();for(const cell of row){const td=tr.insertCell();td.textContent=String(cell ?? "");td.style.cssText="border:1px solid #aaa;padding:5px";}}
        doc.body.append(table);
        frame.contentWindow.focus();frame.contentWindow.print();setTimeout(()=>frame.remove(),60000);
      }
    } catch(e) {toast(e instanceof Error ? e.message : "Export failed", "error");}
    finally {setExporting(false);}
  }
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
        <Link className="btn btn-outline" to="/patients">Find Patient</Link>
        <Link className="btn btn-outline" to="/shifts">Shifts</Link>
      </div>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && !q.error && <>
        <p className="muted">Query last updated · {new Date(q.dataUpdatedAt).toLocaleString()}</p>
        <p className="muted">{pending.length} local entries awaiting synchronization. Counts exclude unsent entries.</p>
        <div className="field">
          <label htmlFor="dashboard-ward">Ward</label>
          <select id="dashboard-ward" className="input" value={ward} onChange={e => {setWard(e.target.value);setLimit(20);}}>
            <option value="">All wards</option>
            {wards.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="dashboard-category">Category</label><select id="dashboard-category" className="input" value={category} onChange={e=>{setCategory(e.target.value);setLimit(20);}}><option value="">All categories</option>{[...new Set(patients.map(p=>p.category))].sort().map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="dashboard-metrics">
          {metrics.map(([key, label]) => <button type="button" key={key} className="card dashboard-metric" aria-pressed={group === key} onClick={() => {setGroup(key);setLimit(20);}}>
            <span>{label}</span><strong>{groups[key].length}</strong>
          </button>)}
        </div>
        <p className="muted">No assessment today does not necessarily mean a round is overdue. Review assessment dates before acting.</p>
        <h2 className="section-title">{metrics.find(([key]) => key === group)?.[1]}</h2>
        {groups[group].length === 0 && <Empty title="No matching patients">No patients match this view in the available records.</Empty>}
        {groups[group].slice(0,limit).map(p => <div key={p.id} className="stack-s">
          <PatientCard patient={p} nameOf={nameOf} />
          <div className="row wrap">
            <Link className="btn btn-primary grow" to={`/patients/${p.id}/round?kind=pain`}>Pain Round</Link>
            <Link className="btn btn-outline grow" to={`/patients/${p.id}/round?kind=ward`}>Ward Round</Link>
          </div>
        </div>)}
        {groups[group].length > limit && <button className="btn btn-outline" onClick={()=>setLimit(n=>n+20)}>Show more patients</button>}
        <Analytics patients={selected} date={date} nameOf={nameOf} onWard={w=>{setWard(w);setGroup("all");setLimit(20);window.scrollTo(0,0);}} onCategory={c=>{setCategory(c);setGroup("all");setLimit(20);window.scrollTo(0,0);}} />
        {profile?.role === "admin" && <section className="card stack-s"><h2>Dashboard reports</h2><p className="muted">Aggregate report for current filters. No patient names or BHT numbers.</p><div className="row wrap"><button className="btn btn-outline" disabled={exporting} onClick={()=>void exportReport("csv")}>Export CSV</button><button className="btn btn-outline" disabled={exporting} onClick={()=>void exportReport("pdf")}>Print / Save PDF</button></div></section>}
      </>}
    </div>
  );
}
