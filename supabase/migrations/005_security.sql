-- 005: who may do what (Row Level Security)
create function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create function public.current_app_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

revoke execute on function public.is_active_user(), public.current_app_role() from public, anon;
grant  execute on function public.is_active_user(), public.current_app_role() to authenticated;

alter table public.profiles       enable row level security;
alter table public.patients       enable row level security;
alter table public.patient_meds   enable row level security;
alter table public.patient_alerts enable row level security;
alter table public.rounds         enable row level security;
alter table public.audit_log      enable row level security;

-- table permissions: start from NOTHING, then grant only what the app needs.
-- (Supabase hands new tables broad default permissions; we remove them, and stop
--  future tables from getting them automatically. Add explicit grants for new tables.)
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
grant usage on schema public to authenticated;
grant select, update                 on public.profiles       to authenticated;
grant select, insert, update         on public.patients       to authenticated;
grant select, insert, update, delete on public.patient_meds   to authenticated;
grant select, insert                 on public.patient_alerts to authenticated;
grant select, insert                 on public.rounds         to authenticated;
grant select                         on public.audit_log      to authenticated;

create policy profiles_read  on public.profiles for select
  using (public.is_active_user() or id = auth.uid());
create policy profiles_admin on public.profiles for update
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy patients_read   on public.patients for select using (public.is_active_user());
create policy patients_insert on public.patients for insert
  with check (public.is_active_user() and created_by = auth.uid());
create policy patients_update on public.patients for update
  using (public.is_active_user()) with check (public.is_active_user());

create policy meds_read   on public.patient_meds for select using (public.is_active_user());
create policy meds_insert on public.patient_meds for insert with check (public.is_active_user());
create policy meds_update on public.patient_meds for update
  using (public.is_active_user()) with check (public.is_active_user());
create policy meds_delete on public.patient_meds for delete using (public.is_active_user());

create policy alerts_read   on public.patient_alerts for select using (public.is_active_user());
create policy alerts_insert on public.patient_alerts for insert
  with check (public.is_active_user() and created_by = auth.uid());

create policy rounds_read   on public.rounds for select using (public.is_active_user());
create policy rounds_insert on public.rounds for insert
  with check (public.is_active_user() and created_by = auth.uid());

create policy audit_read on public.audit_log for select
  using (public.current_app_role() = 'admin');
