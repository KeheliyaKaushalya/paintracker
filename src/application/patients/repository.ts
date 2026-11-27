import type { PatientFull } from "../../domain/clinical/models";
import type { PatientBuild } from "../../domain/patients/schemas";

export interface PatientSaveOutcome {
  id: string;
  warnings: string[];
}
export interface PatientRepository {
  fetchPatients(status: "active" | "discharged"): Promise<PatientFull[]>;
  fetchPatient(id: string): Promise<PatientFull | null>;
  createPatient(
    build: PatientBuild,
    userId: string,
  ): Promise<PatientSaveOutcome>;
  updatePatient(
    id: string,
    build: PatientBuild,
    existingMedIds: string[],
  ): Promise<PatientSaveOutcome>;
}
export function patientUseCases(repository: PatientRepository) {
  return {
    fetchPatients: (status: "active" | "discharged") =>
      repository.fetchPatients(status),
    fetchPatient: (id: string) => repository.fetchPatient(id),
    createPatient: (build: PatientBuild, userId: string) =>
      repository.createPatient(build, userId),
    updatePatient: (
      id: string,
      build: PatientBuild,
      existingMedIds: string[],
    ) => repository.updatePatient(id, build, existingMedIds),
  };
}
