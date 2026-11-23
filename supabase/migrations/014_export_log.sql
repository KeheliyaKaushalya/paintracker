create table public.export_log (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('patients_csv','rounds_csv','workbook_ods')),
  row_count   integer not null,
  exported_by uuid not null default auth.uid() references public.profiles(id),
  exported_at timestamptz not null default now()
);
alter table public.export_log enable row level security;
grant select, insert on public.export_log to authenticated;
create policy export_log_read on public.export_log for select using (public.current_app_role() = 'admin');
create policy export_log_insert on public.export_log for insert
  with check (public.current_app_role() = 'admin' and exported_by = auth.uid());
create trigger audit_export_log after insert or update or delete on public.export_log
  for each row execute function public.audit();