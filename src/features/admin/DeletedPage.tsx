import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../shared/components/Icon";
import { useToast } from "../../shared/components/Toast";
import { Empty, ErrorBox, Spinner } from "../../shared/components/ui";
import { fmtStamp } from "../../domain/clinical/dates";
import { restorePatient } from "../../infrastructure/repositories/patients";
import { useDeletedPatients, useNameLookup } from "../patients/hooks";

export function DeletedPage() {
  const q = useDeletedPatients();
  const nameOf = useNameLookup();
  const qc = useQueryClient();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function restore(id: string) {
    setBusyId(id);
    try {
      await restorePatient(id);
      await qc.invalidateQueries();
      toast("Record restored");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not restore", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack">
      <div className="row between">
        <Link to="/team" className="btn btn-ghost btn-sm">
          <Icon name="back" />
          Team
        </Link>
        <h1 style={{ fontSize: 20 }}>Deleted records</h1>
      </div>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && q.data.length === 0 && <Empty title="No deleted records" />}
      <div className="card">
        {(q.data ?? []).map((p) => (
          <div className="user-row" key={p.id}>
            <div>
              <Link to={`/patients/${p.id}`}>
                <strong>{p.full_name}</strong>
              </Link>{" "}
              <span className="mono faint">{p.bht}</span>
              <div className="faint">
                {p.delete_reason} ·{" "}
                {p.deleted_by ? nameOf(p.deleted_by) : "unknown"} ·{" "}
                {fmtStamp(p.deleted_at)}
              </div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              disabled={busyId === p.id}
              onClick={() => void restore(p.id)}
            >
              Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
