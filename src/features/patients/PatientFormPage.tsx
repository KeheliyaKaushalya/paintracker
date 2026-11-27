import { useParams } from "react-router-dom";
import { Empty, ErrorBox, Spinner } from "../../shared/components/ui";
import { usePatient } from "./hooks";
import { emptyPatientForm, patientToForm } from "../../domain/patients/schemas";
import { PatientForm } from "./PatientForm";

export function PatientFormPage() {
  const { id } = useParams();
  const q = usePatient(id);
  if (!id)
    return <PatientForm initial={emptyPatientForm()} existingMedIds={[]} />;
  if (q.isLoading) return <Spinner />;
  if (q.error)
    return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <Empty title="Patient not found" />;
  return (
    <PatientForm
      key={q.data.id}
      initial={patientToForm(q.data)}
      patientId={q.data.id}
      existingMedIds={q.data.patient_meds.map((m) => m.id)}
    />
  );
}
