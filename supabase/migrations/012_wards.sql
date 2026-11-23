create table public.wards (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  active     boolean not null default true,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index wards_name_ci on public.wards (lower(trim(name)));
insert into public.wards (name) values ('7A'),('23B'),('39'),('OT Complex'),('ICU'),('Other');
insert into public.wards (name) select distinct trim(ward) from public.patients on conflict do nothing;

alter table public.wards enable row level security;
grant select, insert, update on public.wards to authenticated;
create policy wards_read   on public.wards for select using (public.is_active_user());
create policy wards_insert on public.wards for insert with check (public.is_active_user());
create policy wards_update on public.wards for update
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create trigger audit_wards after insert or update or delete on public.wards
  for each row execute function public.audit();
alter publication supabase_realtime add table public.wards;