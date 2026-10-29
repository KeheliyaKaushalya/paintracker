-- 007: everyone may set their OWN display name; only admins may change roles or approval.
create policy profiles_self_name on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null for the SQL editor / service role, which is how the first admin is created.
  if auth.uid() is not null
     and (new.role is distinct from old.role or new.active is distinct from old.active or new.id is distinct from old.id)
     and public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an administrator can change roles or approval' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();
