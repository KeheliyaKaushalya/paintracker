-- 002: patients, their medications and alerts
create table public.patients (
  id              uuid primary key default gen_random_uuid(),
  bht             text not null check (length(trim(bht)) > 0),
  full_name       text not null check (length(trim(full_name)) > 0),
  age             smallint check (age between 0 and 120),
  sex             text check (sex in ('M','F')),
  ward            text not null,
  category        text not null default 'Surgery'
                  check (category in ('Surgery','Difficult airway','Anaphylaxis','Medical issue','Other')),
  category_note   text,
  surgery         text,
  indication      text,
  surgery_date    date,
  surgery_time    time,
  anaesthesia_mode text check (anaesthesia_mode in ('GA','Spinal','CSE','Regional')),

  has_epidural      boolean not null default false,
  ep_level          text,
  ep_inserted_date  date,
  ep_inserted_time  time,
  ep_test_dose      text,

  has_nerve_catheter boolean not null default false,
  nv_type           text check (nv_type in ('Supraclavicular','Rectus sheath','Femoral','Other')),
  nv_inserted_date  date,
  nv_inserted_time  time,

  has_pca           boolean not null default false,
  pca_drug          text,
  pca_bolus         text,
  pca_lockout       text,
  pca_max_hr        text,

  status          text not null default 'active' check (status in ('active','discharged')),
  discharged_date date,
  created_by      uuid not null default auth.uid() references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint patients_bht_unique unique (bht),
  constraint patients_discharge_ck check ((status = 'discharged') = (discharged_date is not null))
);
create index patients_status_ward_idx on public.patients (status, ward);

create table public.patient_meds (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  sort_order  smallint not null default 0,
  drug        text not null check (drug in ('Paracetamol','Tramadol','Morphine','Pregabalin','Gabapentin','Celecoxib (Cox-2)','Diclofenac (NSAID)','Other')),
  route       text not null check (route in ('Oral','IV','IM','SC','PR','IT','Epidural')),
  dose        text,
  freq        text check (freq in ('Every 4h','Every 6h','Every 8h','Every 12h','Other')),
  freq_custom text,
  dosing      text not null default 'single' check (dosing in ('single','loading')),
  topup       text
);
create index patient_meds_patient_idx on public.patient_meds (patient_id);

create table public.patient_alerts (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete restrict,
  alert_text  text not null check (length(trim(alert_text)) > 0),
  created_by  uuid not null default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index patient_alerts_patient_idx on public.patient_alerts (patient_id, created_at desc);

-- keep updated_at fresh, and stop anyone rewriting who created a patient
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create function public.lock_created_fields() returns trigger language plpgsql as $$
begin new.created_by := old.created_by; new.created_at := old.created_at; return new; end $$;

create trigger patients_updated before update on public.patients
  for each row execute function public.set_updated_at();
create trigger patients_lock before update on public.patients
  for each row execute function public.lock_created_fields();
