begin;
-- Reuse existing wards and export_log tables from migrations 012 and 014.
create or replace function public.register_patient_ward() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if length(trim(new.ward)) > 0 then
    insert into public.wards(name) values(trim(new.ward))
    on conflict (lower(trim(name))) do nothing;
  end if;
  return new;
end; $$;
revoke all on function public.register_patient_ward() from public;
drop trigger if exists register_patient_ward on public.patients;
create trigger register_patient_ward after insert or update of ward on public.patients
for each row execute function public.register_patient_ward();
-- Existing ward references are text; hiding a ward preserves patient history.
drop trigger if exists guard_ward_deactivation on public.wards;
alter table public.export_log drop constraint if exists export_log_kind_check;
alter table public.export_log add constraint export_log_kind_check check (kind in ('patients_csv','rounds_csv','workbook_ods','ods','summary','full','patients','rounds','medications','dose','notes','wards'));
create or replace function public.log_export(description text, export_kind text, row_count integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Admin required'; end if;
 insert into public.export_log(kind,row_count,exported_by) values(export_kind,row_count,auth.uid());
 insert into public.audit_log(actor,table_name,action) values(auth.uid(),'exports',description);
end; $$;
revoke all on function public.log_export(text,text,integer) from public;
grant execute on function public.log_export(text,text,integer) to authenticated;
commit;
