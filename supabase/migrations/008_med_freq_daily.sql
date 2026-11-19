alter table public.patient_meds drop constraint patient_meds_freq_check;
alter table public.patient_meds add constraint patient_meds_freq_check
  check (freq in ('Every 4h','Every 6h','Every 8h','Every 12h','Daily','Other'));