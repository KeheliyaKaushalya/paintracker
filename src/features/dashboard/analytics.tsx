import { Link } from "react-router-dom";
import type { PatientFull } from "../../domain/clinical/models";
import { effectiveRounds } from "../../domain/clinical/rounds";
import { todayISO, fmtStamp } from "../../domain/clinical/dates";
import { isActiveMed } from "../../domain/clinical/meds";
import { dashboardGroups, painDistribution, painTrends } from "./metrics";
import type { Cell } from "../../infrastructure/platform/export";

export function recentActivity(patients: PatientFull[]) {
  return patients.flatMap(p => {
    const event = (id: string, time: string | null, actor: string | null, label: string) => ({ id, time: time ?? "", actor, label, patient: p });
    return [event(`admit-${p.id}`, p.created_at, p.created_by, "Patient registered"),
      ...effectiveRounds(p.rounds).map(r => event(r.id, r.created_at, r.created_by, `${r.kind === "pain" ? "Pain" : "Ward"} round recorded`)),
      ...p.patient_meds.flatMap(m => [event(`start-${m.id}`, m.started_at, m.started_by, `Medication started: ${m.drug}`), event(`end-${m.id}`, m.ended_at, m.ended_by, `Medication ended: ${m.drug}`)]),
      ...p.patient_alerts.flatMap(a => [event(a.id, a.created_at, a.created_by, "Clinical alert recorded"), event(`resolved-${a.id}`, a.resolved_at, a.resolved_by, "Clinical alert resolved")])];
  }).filter(e => e.time).sort((a,b) => b.time.localeCompare(a.time)).slice(0,15);
}
export function lastSevenDays() {
  return Array.from({length:7}, (_,i) => { const d = new Date(); d.setDate(d.getDate()-6+i); return todayISO(d); });
}
export function reportRows(patients: PatientFull[], date: string, ward: string): Cell[][] {
  const g = dashboardGroups(patients,date);
  const dist = painDistribution(patients);
  return [["Clinical dashboard",date], ["Ward",ward || "All wards"], ["Scope","Available active patients; aggregate counts"], ["Metric","Count"], ...Object.entries(g).map(([k,v]) => [k,v.length]), ...Object.entries(dist).map(([k,v]) => [`Pain ${k}`,v]), ["Ward","Active","Requires review","Assessed today"], ...[...new Set(patients.map(p=>p.ward))].sort().map(w=>{const x=dashboardGroups(patients.filter(p=>p.ward===w),date);return [w,x.all.length,x.attention.length,x.assessed.length];}), ["Category","Active"], ...[...new Set(patients.map(p=>p.category))].sort().map(c=>[c,patients.filter(p=>p.category===c).length]), ["Date","Mean rest","Rest n","Mean movement","Movement n"], ...painTrends(patients,lastSevenDays()).map(t=>[t.date,t.rest.mean?.toFixed(1),t.rest.n,t.move.mean?.toFixed(1),t.move.n])];
}
export function Analytics({patients,date,nameOf,onWard,onCategory}:{patients:PatientFull[];date:string;nameOf:(id:string)=>string;onWard:(w:string)=>void;onCategory:(c:string)=>void}) {
  const dist=painDistribution(patients);
  const trends=painTrends(patients,lastSevenDays());
  const meds=new Map<string,number>();
  for(const p of patients) for(const drug of new Set(p.patient_meds.filter(isActiveMed).map(m=>m.drug))) meds.set(drug,(meds.get(drug)??0)+1);
  return <>
    <section className="card stack-s dashboard-analytics"><h2>Daily assessment coverage</h2><p>{dashboardGroups(patients,date).assessed.length} of {patients.length} active patients assessed today</p><progress max={patients.length || 1} value={dashboardGroups(patients,date).assessed.length}/><p className="muted">Coverage only; no prescribed schedule.</p></section>
    <section className="card stack-s dashboard-analytics"><h2>Ward overview</h2>{[...new Set(patients.map(p=>p.ward))].sort().map(w=>{const g=dashboardGroups(patients.filter(p=>p.ward===w),date);return <button key={w} className="btn btn-outline dashboard-breakdown" onClick={()=>onWard(w)}>{w}: {g.all.length} active · {g.attention.length} review · {g.assessed.length} assessed</button>})}</section>
    <section className="card stack-s dashboard-analytics"><h2>Category overview</h2>{[...new Set(patients.map(p=>p.category))].sort().map(c=><button key={c} className="btn btn-outline dashboard-breakdown" onClick={()=>onCategory(c)}>{c}: {patients.filter(p=>p.category===c).length}</button>)}</section>
    <section className="card stack-s dashboard-analytics"><h2>Latest pain severity</h2>{([['Mild (0–3)',dist.low],['Moderate (4–6)',dist.mid],['Severe (7–10)',dist.high],['Missing scores',dist.missing]] as const).map(([label,n])=><div key={label}><div>{label}: {n}</div><progress max={patients.length || 1} value={n}/></div>)}<p className="muted">Highest recorded rest or movement score in latest effective pain round.</p></section>
    <section className="card stack-s dashboard-analytics"><h2>Pain trends · 7 days</h2><p className="muted">Mean per recorded score, active cohort only. Missing scores excluded.</p>{trends.map(t=><div key={t.date} className="dashboard-trend"><strong>{t.date}</strong>{([['Rest',t.rest],['Movement',t.move]] as const).map(([label,v])=><div key={label}><span>{label}: {v.mean?.toFixed(1) ?? '—'} (n={v.n})</span><progress max={10} value={v.mean ?? 0} aria-label={`${label} mean ${v.mean?.toFixed(1) ?? 'missing'}`}/></div>)}</div>)}</section>
    <section className="card stack-s dashboard-analytics"><h2>Medication monitoring</h2><p className="muted">Active patients per recorded drug</p>{[...meds].sort((a,b)=>b[1]-a[1]).map(([drug,n])=><div key={drug}>{drug}: {n}</div>)}{!meds.size && <p>No active medications recorded.</p>}</section>
    <section className="card stack-s dashboard-analytics"><h2>Recent clinical activity</h2>{recentActivity(patients).map(e=><div key={e.id}><Link to={`/patients/${e.patient.id}`}>{e.patient.full_name}</Link> · {e.label}<div className="muted">{fmtStamp(e.time)} · {e.actor ? nameOf(e.actor) : 'Unknown'}</div></div>)}<p className="muted">Latest 15 available events for active patients. Full history and dose changes are in the patient timeline.</p></section>
  </>;
}
