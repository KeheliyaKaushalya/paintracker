-- 006: live updates between phones
alter publication supabase_realtime
  add table public.patients, public.patient_meds, public.patient_alerts, public.rounds;
