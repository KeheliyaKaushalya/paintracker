create table public.shift_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  start_time time not null,
  end_time   time not null,          -- end <= start means the shift runs overnight
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.shift_templates (name, start_time, end_time)
  values ('Day','08:00','20:00'), ('Night','20:00','08:00');

create table public.shift_assignments (
  id            uuid primary key default gen_random_uuid(),
  shift_date    date not null,
  template_id   uuid not null references public.shift_templates(id) on delete restrict,
  assignee_id   uuid references public.profiles(id),   -- a registered user…
  assignee_name text,                                  -- …or an outside name
  note          text,
  assigned_by   uuid references public.profiles(id),
  updated_at    timestamptz not null default now(),
  constraint shift_assignments_unique unique (shift_date, template_id),
  constraint shift_assignee_ck check (assignee_id is null or assignee_name is null)
);                                                     -- both null = "marked unassigned"

create function public.stamp_shift_assignment() returns trigger language plpgsql as $$
begin new.assigned_by := auth.uid(); new.updated_at := now(); return new; end $$;
create trigger shift_assignments_stamp before insert or update on public.shift_assignments
  for each row execute function public.stamp_shift_assignment();

alter table public.shift_templates   enable row level security;
alter table public.shift_assignments enable row level security;
grant select, insert, update on public.shift_templates   to authenticated;
grant select, insert, update on public.shift_assignments to authenticated;
create policy shift_tpl_read  on public.shift_templates for select using (public.is_active_user());
create policy shift_tpl_write on public.shift_templates for insert with check (public.current_app_role() = 'admin');
create policy shift_tpl_upd   on public.shift_templates for update
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy shift_asg_read  on public.shift_assignments for select using (public.is_active_user());
create policy shift_asg_write on public.shift_assignments for insert with check (public.is_active_user());
create policy shift_asg_upd   on public.shift_assignments for update
  using (public.is_active_user()) with check (public.is_active_user());
create trigger audit_shift_tpl after insert or update or delete on public.shift_templates
  for each row execute function public.audit();
create trigger audit_shift_asg after insert or update or delete on public.shift_assignments
  for each row execute function public.audit();
alter publication supabase_realtime add table public.shift_templates, public.shift_assignments;