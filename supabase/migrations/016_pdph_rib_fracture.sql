-- 016: PDPH and Rib fracture categories, plus PDPH details
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.patients'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category = any%'
  loop
    execute format('alter table public.patients drop constraint %I', c);
  end loop;
end $$;

alter table public.patients drop constraint if exists patients_category_check;
alter table public.patients add constraint patients_category_check
  check (category in ('Surgery','PDPH','Rib fracture','Difficult airway','Anaphylaxis','Medical issue','Other'));

alter table public.patients
  add column if not exists pdph_level      text,
  add column if not exists pdph_needle     text,
  add column if not exists pdph_attempts   smallint check (pdph_attempts between 1 and 20),
  add column if not exists pdph_symptoms   text,
  add column if not exists pdph_complaint  text,
  add column if not exists pdph_condition  text,
  add column if not exists pdph_management text;