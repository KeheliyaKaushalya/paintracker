import { useParams, useSearchParams } from "react-router-dom";
import { Empty, ErrorBox, Spinner } from "../../shared/components/ui";
import { usePatient } from "../patients/hooks";
import { RoundForm } from "./RoundForm";

export function RoundFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const q = usePatient(id);
  const amendId = params.get("amend");
  const kind = params.get("kind") === "ward" ? "ward" : "pain";

  if (q.isLoading) return <Spinner />;
  if (q.error)
    return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <Empty title="Patient not found" />;
  const amend = amendId
    ? q.data.rounds.find((r) => r.id === amendId)
    : undefined;
  if (amendId && !amend) return <Empty title="That round was not found" />;
  return (
    <RoundForm
      key={amend?.id ?? kind}
      patient={q.data}
      amend={amend}
      kind={amend ? (amend.kind === "ward" ? "ward" : "pain") : kind}
    />
  );
}
