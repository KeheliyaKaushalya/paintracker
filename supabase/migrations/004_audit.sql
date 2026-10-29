-- 004: audit trail of every insert / update / delete
create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid default auth.uid(),
  table_name text not null,
  row_id     uuid,
  action     text not null,
  old_row    jsonb,
  new_row    jsonb
);

create function public.audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, row_id, action, old_row, new_row)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger audit_profiles after insert or update or delete on public.profiles       for each row execute function public.audit();
create trigger audit_patients after insert or update or delete on public.patients       for each row execute function public.audit();
create trigger audit_meds     after insert or update or delete on public.patient_meds   for each row execute function public.audit();
create trigger audit_alerts   after insert or update or delete on public.patient_alerts for each row execute function public.audit();
create trigger audit_rounds   after insert or update or delete on public.rounds         for each row execute function public.audit();
