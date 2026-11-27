begin;
alter table public.patient_meds drop constraint if exists patient_meds_drug_check;
alter table public.patient_meds add constraint patient_meds_drug_check
  check (length(btrim(drug)) between 1 and 200);
commit;
