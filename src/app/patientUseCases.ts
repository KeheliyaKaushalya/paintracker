import { patientUseCases } from "../application/patients/repository";
import * as repository from "../infrastructure/repositories/patients";
export const { fetchPatients, fetchPatient, createPatient, updatePatient } =
  patientUseCases(repository);
