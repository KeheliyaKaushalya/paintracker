alter table public.patients
  add column deleted_at   timestamptz,
  add column deleted_by   uuid references public.profiles(id),
  add column delete_reason text,
  add constraint patients_deleted_ck check ((deleted_at is null) = (delete_reason is null)),
  add constraint patients_deleted_reason_ck check (deleted_at is null or length(trim(delete_reason)) > 0);

-- only an administrator may delete or restore, and the record always shows who and when
create function public.guard_patient_delete() returns trigger language plpgsql as $$
begin
  if new.deleted_at is distinct from old.deleted_at
     or new.deleted_by is distinct from old.deleted_by
     or new.delete_reason is distinct from old.delete_reason then
    if auth.uid() is not null and public.current_app_role() is distinct from 'admin' then
      raise exception 'Only an administrator can delete or restore a patient record' using errcode = '42501';
    end if;
    if new.deleted_at is null then
      new.deleted_by := null; new.delete_reason := null;
    else
      new.deleted_at := now(); new.deleted_by := auth.uid();
    end if;
  end if;
  return new;
end $$;
create trigger patients_delete_guard before update on public.patients
  for each row execute function public.guard_patient_delete();