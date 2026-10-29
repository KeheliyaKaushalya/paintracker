-- =====================================================================
-- SECURITY TEST for the PainTracker database.
-- Run in the Supabase SQL Editor (or psql) AFTER migrations 001-006.
-- It creates 3 temporary fake users and fake data, checks every rule,
-- prints PASS/FAIL notices, then ROLLS BACK so nothing is left behind.
-- Any FAIL raises an error and stops. If you reach the final "ALL
-- SECURITY TESTS PASSED" notice, the rules work.
-- =====================================================================
begin;

create function pg_temp.run_as(uid uuid, stmt text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when uid is null then '' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
  execute case when uid is null then 'set local role anon' else 'set local role authenticated' end;
  begin
    execute stmt;
    reset role;
    return 'ok';
  exception when others then
    reset role;
    return 'error: ' || sqlerrm;
  end;
end $$;

create function pg_temp.count_as(uid uuid, stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims',
    case when uid is null then '' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
  execute case when uid is null then 'set local role anon' else 'set local role authenticated' end;
  begin
    execute stmt into n;
    reset role;
    return n;
  exception when others then
    reset role;
    return -1;   -- -1 means "error / not allowed"
  end;
end $$;

create function pg_temp.check_that(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok then raise notice 'PASS: %', label;
  else raise exception 'FAIL: %', label;
  end if;
end $$;

do $$
declare
  admin_id   uuid := '00000000-0000-4000-8000-0000000000a1';
  nurse_id   uuid := '00000000-0000-4000-8000-0000000000a2';
  pending_id uuid := '00000000-0000-4000-8000-0000000000a3';
  pid        uuid := '00000000-0000-4000-8000-0000000000b1';
  rid        uuid := '00000000-0000-4000-8000-0000000000c1';
  r          text;
  n          bigint;
  who        uuid;
begin
  -- ---- set-up (as the database owner) ----
  insert into auth.users (id, email) values
    (admin_id, 'admin@test.local'), (nurse_id, 'nurse@test.local'), (pending_id, 'pending@test.local');
  perform pg_temp.check_that((select count(*) from public.profiles where id in (admin_id, nurse_id, pending_id)) = 3,
    'a profile row is created automatically for each new login');
  perform pg_temp.check_that(not (select active from public.profiles where id = pending_id), 'new users start INACTIVE');
  update public.profiles set role = 'admin', active = true where id = admin_id;
  update public.profiles set role = 'nurse', active = true where id = nurse_id;
  insert into public.patients (id, bht, full_name, age, sex, ward, created_by)
    values (pid, 'TEST/0001', 'Test Patient', 61, 'M', '7A', admin_id);

  -- ---- logged-out visitor ----
  perform pg_temp.check_that(pg_temp.count_as(null, 'select count(*) from public.patients') = -1,
    'logged-out visitor cannot read patients');
  perform pg_temp.check_that(pg_temp.run_as(null, $q$insert into public.patients (bht, full_name, ward) values ('X','X','X')$q$) like 'error%',
    'logged-out visitor cannot insert patients');
  perform pg_temp.check_that(pg_temp.count_as(null, 'select count(*) from public.profiles') = -1,
    'logged-out visitor cannot read profiles');

  -- ---- inactive (not yet approved) user ----
  perform pg_temp.check_that(pg_temp.count_as(pending_id, 'select count(*) from public.patients') = 0,
    'unapproved user sees zero patients');
  perform pg_temp.check_that(pg_temp.count_as(pending_id, 'select count(*) from public.rounds') = 0,
    'unapproved user sees zero rounds');
  perform pg_temp.check_that(pg_temp.run_as(pending_id,
    format($q$insert into public.patients (bht, full_name, ward, created_by) values ('P/1','P','7A','%s')$q$, pending_id)) like 'error%',
    'unapproved user cannot add patients');
  perform pg_temp.check_that(pg_temp.count_as(pending_id, 'select count(*) from public.profiles') = 1,
    'unapproved user can only see their own profile');

  -- ---- approved nurse: patients ----
  perform pg_temp.check_that(pg_temp.count_as(nurse_id, 'select count(*) from public.patients') = 1,
    'approved nurse can read patients');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.patients (bht, full_name, ward, created_by) values ('N/1','Nurse Patient','7A','%s')$q$, nurse_id)) = 'ok',
    'nurse can add a patient under their own name');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.patients (bht, full_name, ward, created_by) values ('N/2','Fake Author','7A','%s')$q$, admin_id)) like 'error%',
    'nurse cannot add a patient in someone else''s name');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.patients (bht, full_name, ward, created_by) values ('N/1','Duplicate BHT','7A','%s')$q$, nurse_id)) like 'error%',
    'duplicate BHT numbers are rejected');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id, $q$delete from public.patients$q$) like 'error%',
    'nobody can delete patients');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$update public.patients set ward = '23B', created_by = '%s' where id = '%s'$q$, nurse_id, pid)) = 'ok',
    'nurse can edit a patient');
  select created_by into who from public.patients where id = pid;
  perform pg_temp.check_that(who = admin_id, 'the original author of a patient cannot be rewritten');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$update public.patients set status = 'discharged' where id = '%s'$q$, pid)) like 'error%',
    'discharge without a discharge date is rejected');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$update public.patients set status = 'discharged', discharged_date = current_date where id = '%s'$q$, pid)) = 'ok',
    'nurse can discharge a patient with a date');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id, format($q$update public.patients set age = 200 where id = '%s'$q$, pid)) like 'error%',
    'impossible age is rejected');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id, format($q$update public.patients set category = 'Nonsense' where id = '%s'$q$, pid)) like 'error%',
    'unknown category is rejected');

  -- ---- rounds ----
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.rounds (id, patient_id, kind, round_date, session, pain_rest, pain_move, spo2, bp_sys, bp_dia, created_by)
              values ('%s','%s','pain', current_date, 'Morning', 3, 5, 97, 120, 80, '%s')$q$, rid, pid, nurse_id)) = 'ok',
    'nurse can add a pain round');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.rounds (patient_id, kind, round_date, pain_rest, pain_move, spo2, created_by)
              values ('%s','pain', current_date, 3, 5, 980, '%s')$q$, pid, nurse_id)) like 'error%',
    'SpO2 of 980 is rejected (typo protection)');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.rounds (patient_id, kind, round_date, pain_rest, created_by)
              values ('%s','pain', current_date, 3, '%s')$q$, pid, nurse_id)) like 'error%',
    'a pain round needs both rest and movement scores');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.rounds (patient_id, kind, round_date, pain_rest, pain_move, bp_sys, created_by)
              values ('%s','pain', current_date, 3, 4, 120, '%s')$q$, pid, nurse_id)) like 'error%',
    'blood pressure needs both numbers');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.rounds (patient_id, kind, round_date, session, pain_rest, pain_move, created_by)
              values ('%s','pain', current_date, 'Afternoon', 3, 4, '%s')$q$, pid, nurse_id)) like 'error%',
    'unknown session is rejected');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.rounds (patient_id, kind, round_date, tags, pain_rest, pain_move, created_by)
              values ('%s','pain', current_date, array['Made up tag'], 3, 4, '%s')$q$, pid, nurse_id)) like 'error%',
    'unknown tag is rejected');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.rounds (patient_id, kind, round_date, note, tags, created_by)
              values ('%s','ward', current_date, 'Comfortable, no new concerns', array['Urgent review'], '%s')$q$, pid, nurse_id)) = 'ok',
    'nurse can add a simple ward round');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.rounds (patient_id, kind, round_date, pain_rest, pain_move, created_by)
              values ('%s','pain', current_date, 2, 2, '%s')$q$, pid, admin_id)) like 'error%',
    'nurse cannot add a round in someone else''s name');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$update public.rounds set pain_rest = 0 where id = '%s'$q$, rid)) like 'error%',
    'rounds cannot be edited');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id, $q$delete from public.rounds$q$) like 'error%',
    'rounds cannot be deleted');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.rounds (patient_id, kind, round_date, pain_rest, pain_move, amended_of, created_by)
              values ('%s','pain', current_date, 4, 4, '%s', '%s')$q$, pid, rid, nurse_id)) = 'ok',
    'a correction is saved as a NEW round pointing at the old one');
  perform pg_temp.check_that(pg_temp.count_as(nurse_id, 'select count(*) from public.rounds') = 3,
    'the original round is still there after the correction');

  -- ---- medications and alerts ----
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.patient_meds (patient_id, drug, route, dose, freq) values ('%s','Paracetamol','IV','1 g','Every 6h')$q$, pid)) = 'ok',
    'nurse can add a medication');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.patient_meds (patient_id, drug, route) values ('%s','Aspirin','IV')$q$, pid)) like 'error%',
    'unknown drug is rejected');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id, format($q$delete from public.patient_meds where patient_id = '%s'$q$, pid)) = 'ok',
    'medications can be replaced when a patient is edited');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.patient_alerts (patient_id, alert_text, created_by) values ('%s','Do not remove catheter','%s')$q$, pid, nurse_id)) = 'ok',
    'nurse can add an alert');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.patient_alerts (patient_id, alert_text, created_by) values ('%s','Forged','%s')$q$, pid, admin_id)) like 'error%',
    'nurse cannot add an alert in someone else''s name');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id, $q$update public.patient_alerts set alert_text = 'changed'$q$) like 'error%',
    'alerts cannot be edited');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id, $q$delete from public.patient_alerts$q$) like 'error%',
    'alerts cannot be deleted');

  -- ---- roles, approval and the audit log ----
  perform pg_temp.run_as(nurse_id, format($q$update public.profiles set role = 'admin', active = true where id = '%s'$q$, nurse_id));
  perform pg_temp.check_that((select role from public.profiles where id = nurse_id) = 'nurse',
    'a nurse cannot promote themselves to admin');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$update public.profiles set role = 'admin' where id = '%s'$q$, nurse_id)) like 'error%',
    'changing your own role is refused with an error');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$update public.profiles set full_name = 'Nurse Real Name' where id = '%s'$q$, nurse_id)) = 'ok'
    , 'a user can change their own display name');
  perform pg_temp.check_that((select full_name from public.profiles where id = nurse_id) = 'Nurse Real Name',
    'the new display name was saved');
  perform pg_temp.run_as(nurse_id, format($q$update public.profiles set full_name = 'Hacked' where id = '%s'$q$, admin_id));
  perform pg_temp.check_that((select full_name from public.profiles where id = admin_id) <> 'Hacked',
    'a user cannot rename someone else');
  perform pg_temp.run_as(pending_id, format($q$update public.profiles set active = true where id = '%s'$q$, pending_id));
  perform pg_temp.check_that(not (select active from public.profiles where id = pending_id),
    'a user cannot approve themselves');
  r := pg_temp.run_as(admin_id, format($q$update public.profiles set active = true where id = '%s'$q$, pending_id));
  perform pg_temp.check_that(r = 'ok' and (select active from public.profiles where id = pending_id),
    'an admin can approve a user');
  perform pg_temp.check_that(pg_temp.count_as(nurse_id, 'select count(*) from public.audit_log') = 0,
    'a nurse sees no audit log entries');
  perform pg_temp.check_that(pg_temp.count_as(admin_id, 'select count(*) from public.audit_log') > 0,
    'an admin can read the audit log');
  perform pg_temp.check_that(pg_temp.run_as(admin_id, $q$delete from public.audit_log$q$) like 'error%',
    'even an admin cannot delete audit entries');
  perform pg_temp.check_that(pg_temp.run_as(admin_id, $q$update public.audit_log set action = 'x'$q$) like 'error%',
    'even an admin cannot edit audit entries');
  select count(*) into n from public.audit_log where table_name = 'rounds' and action = 'INSERT';
  perform pg_temp.check_that(n >= 3, 'every round that was added is in the audit log');

  raise notice '=================================';
  raise notice 'ALL SECURITY TESTS PASSED';
  raise notice '=================================';
end $$;

rollback;
