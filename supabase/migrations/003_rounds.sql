-- 003: ward rounds (one row each; corrections are new rows that point at the old one)
create table public.rounds (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients(id) on delete restrict,
  kind         text not null check (kind in ('pain','ward')),   -- 'ward' = a simple ward round (note only)
  round_date   date not null,
  round_time   time,
  session      text check (session in ('Morning','Evening')),
  pain_rest    smallint check (pain_rest between 0 and 10),
  pain_move    smallint check (pain_move between 0 and 10),
  rr           smallint check (rr     between 0 and 80),      -- wide on purpose: catches typos, never blocks a real emergency
  spo2         smallint check (spo2   between 0 and 100),
  hr           smallint check (hr     between 0 and 300),
  bp_sys       smallint check (bp_sys between 0 and 350),
  bp_dia       smallint check (bp_dia between 0 and 250),
  gcs          smallint check (gcs    between 3 and 15),
  mobilization text check (mobilization in ('Mobilized','Not mobilized')),
  tags         text[] not null default '{}'
               check (tags <@ array['Top-up given','Line removed','Dose changed','Catheter concern','Discharge planned','Urgent review']::text[]),
  note         text,
  amended_of   uuid references public.rounds(id),
  created_by   uuid not null default auth.uid() references public.profiles(id),
  created_at   timestamptz not null default now(),

  constraint rounds_pain_ck check (kind <> 'pain' or (pain_rest is not null and pain_move is not null)),
  constraint rounds_bp_ck   check ((bp_sys is null) = (bp_dia is null))
);
create index rounds_patient_idx on public.rounds (patient_id, round_date desc, round_time desc);
