alter table public.patient_alerts
  add column resolved_at timestamptz,
  add column resolved_by uuid references public.profiles(id),
  add constraint patient_alerts_resolved_ck check ((resolved_at is null) = (resolved_by is null));

-- the text stays immutable: only these two columns may be updated, and the trigger forces them to be honest
grant update (resolved_at, resolved_by) on public.patient_alerts to authenticated;
create policy alerts_resolve on public.patient_alerts for update
  using (public.is_active_user()) with check (public.is_active_user());

create function public.guard_alert_update() returns trigger language plpgsql as $$
begin
  if old.resolved_at is not null then raise exception 'This alert is already resolved'; end if;
  new.alert_text := old.alert_text; new.patient_id := old.patient_id;
  new.created_by := old.created_by; new.created_at := old.created_at;
  new.resolved_at := now(); new.resolved_by := auth.uid();
  return new;
end $$;
create trigger alerts_guard before update on public.patient_alerts
  for each row execute function public.guard_alert_update();

create table public.patient_alert_acks (
  id       uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.patient_alerts(id) on delete restrict,
  user_id  uuid not null default auth.uid() references public.profiles(id),
  acked_at timestamptz not null default now(),
  constraint patient_alert_acks_once unique (alert_id, user_id)
);
alter table public.patient_alert_acks enable row level security;
grant select, insert on public.patient_alert_acks to authenticated;
create policy acks_read on public.patient_alert_acks for select using (public.is_active_user());
create policy acks_insert on public.patient_alert_acks for insert
  with check (public.is_active_user() and user_id = auth.uid());
create trigger audit_acks after insert or update or delete on public.patient_alert_acks
  for each row execute function public.audit();
alter publication supabase_realtime add table public.patient_alert_acks;