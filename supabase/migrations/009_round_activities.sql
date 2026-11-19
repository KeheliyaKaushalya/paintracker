alter table public.rounds
  add column pain_cough  smallint check (pain_cough  between 0 and 10),
  add column pain_physio smallint check (pain_physio between 0 and 10),
  add constraint rounds_activity_ck check (kind = 'pain' or (pain_cough is null and pain_physio is null));