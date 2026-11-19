alter table public.patient_meds
  add column status     text not null default 'active' check (status in ('active','stopped','removed')),
  add column started_at timestamptz,
  add column started_by uuid references public.profiles(id),
  add column ended_at   timestamptz,
  add column ended_by   uuid references public.profiles(id),
  add column end_reason text;
-- existing rows stay NULL = "added before tracking"; only new rows get these defaults
alter table public.patient_meds
  alter column started_at set default now(),
  alter column started_by set default auth.uid();
alter table public.patient_meds
  add constraint patient_meds_end_ck check ((status = 'active') = (ended_at is null)),
  add constraint patient_meds_removed_reason_ck
    check (status <> 'removed' or length(trim(coalesce(end_reason, ''))) > 0);

-- history must never be deleted: medications are stopped or marked entered-in-error instead
drop policy meds_delete on public.patient_meds;
revoke delete on public.patient_meds from authenticated;

create table public.patient_med_changes (
  id         uuid primary key default gen_random_uuid(),
  med_id     uuid not null references public.patient_meds(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  from_dose  text, to_dose text,
  from_freq  text, to_freq text,
  reason     text,
  changed_by uuid not null default auth.uid() references public.profiles(id),
  changed_at timestamptz not null default now()
);
create index patient_med_changes_patient_idx on public.patient_med_changes (patient_id, changed_at desc);
alter table public.patient_med_changes enable row level security;
grant select, insert on public.patient_med_changes to authenticated;
create policy med_changes_read on public.patient_med_changes for select using (public.is_active_user());
create policy med_changes_insert on public.patient_med_changes for insert
  with check (public.is_active_user() and changed_by = auth.uid());
create trigger audit_med_changes after insert or update or delete on public.patient_med_changes
  for each row execute function public.audit();
alter publication supabase_realtime add table public.patient_med_changes;

-- one call = one atomic change, so a dose can never change without its history row
create function public.change_med_dose(p_med uuid, p_dose text, p_freq text, p_freq_custom text, p_reason text)
returns void language plpgsql set search_path = public as $$
declare m public.patient_meds; new_dose text; new_code text; old_freq text; new_freq text;
begin
  select * into m from public.patient_meds where id = p_med for update;
  if not found then raise exception 'Medication not found'; end if;
  if m.status <> 'active' then raise exception 'Only an active medication can be changed'; end if;
  new_code := nullif(trim(p_freq), '');
  new_dose := coalesce(nullif(trim(p_dose), ''), m.dose);
  old_freq := case when m.freq = 'Other' then m.freq_custom else m.freq end;
  new_freq := case when new_code = 'Other' then nullif(trim(p_freq_custom), '') else new_code end;
  if new_code = 'Other' and new_freq is null then raise exception 'Enter the custom frequency'; end if;
  if new_dose is not distinct from m.dose and new_freq is not distinct from old_freq then
    raise exception 'The dose and frequency are unchanged';
  end if;
  insert into public.patient_med_changes (med_id, patient_id, from_dose, to_dose, from_freq, to_freq, reason)
  values (m.id, m.patient_id, m.dose, new_dose, old_freq, new_freq, nullif(trim(p_reason), ''));
  update public.patient_meds
     set dose = new_dose, freq = new_code,
         freq_custom = case when new_code = 'Other' then nullif(trim(p_freq_custom), '') end
   where id = p_med;
end $$;

create function public.end_med(p_med uuid, p_status text, p_reason text)
returns void language plpgsql set search_path = public as $$
begin
  if p_status not in ('stopped','removed') then raise exception 'Invalid status'; end if;
  if p_status = 'removed' and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required'; end if;
  update public.patient_meds
     set status = p_status, ended_at = now(), ended_by = auth.uid(), end_reason = nullif(trim(p_reason), '')
   where id = p_med and status = 'active';
  if not found then raise exception 'Medication not found or already ended'; end if;
end $$;

revoke execute on function public.change_med_dose(uuid,text,text,text,text), public.end_med(uuid,text,text) from public, anon;
grant  execute on function public.change_med_dose(uuid,text,text,text,text), public.end_med(uuid,text,text) to authenticated;