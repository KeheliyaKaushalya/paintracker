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
  mid uuid;
  base_rounds bigint;
  aid uuid;
  tid uuid;
begin
  -- ---- 002:Set-up (as the database owner) ----
  insert into auth.users (id, email) values
    (admin_id, 'admin@test.local'), (nurse_id, 'nurse@test.local'), (pending_id, 'pending@test.local');
  perform pg_temp.check_that((select count(*) from public.profiles where id in (admin_id, nurse_id, pending_id)) = 3,
    'a profile row is created automatically for each new login');
  perform pg_temp.check_that(not (select active from public.profiles where id = pending_id), 'new users start INACTIVE');
  update public.profiles set role = 'admin', active = true where id = admin_id;
  update public.profiles set role = 'nurse', active = true where id = nurse_id;
  insert into public.patients (id, bht, full_name, age, sex, ward, created_by)
    values (pid, 'TEST/0001', 'Test Patient', 61, 'M', '7A', admin_id);
    select count(*) into base_rounds from public.rounds;

  -- ---- 003: Logged-out visitor ----
  perform pg_temp.check_that(pg_temp.count_as(null, 'select count(*) from public.patients') = -1,
    'logged-out visitor cannot read patients');
  perform pg_temp.check_that(pg_temp.run_as(null, $q$insert into public.patients (bht, full_name, ward) values ('X','X','X')$q$) like 'error%',
    'logged-out visitor cannot insert patients');
  perform pg_temp.check_that(pg_temp.count_as(null, 'select count(*) from public.profiles') = -1,
    'logged-out visitor cannot read profiles');

  -- ---- 004: Inactive (not yet approved) user ----
  perform pg_temp.check_that(pg_temp.count_as(pending_id, 'select count(*) from public.patients') = 0,
    'unapproved user sees zero patients');
  perform pg_temp.check_that(pg_temp.count_as(pending_id, 'select count(*) from public.rounds') = 0,
    'unapproved user sees zero rounds');
  perform pg_temp.check_that(pg_temp.run_as(pending_id,
    format($q$insert into public.patients (bht, full_name, ward, created_by) values ('P/1','P','7A','%s')$q$, pending_id)) like 'error%',
    'unapproved user cannot add patients');
  perform pg_temp.check_that(pg_temp.count_as(pending_id, 'select count(*) from public.profiles') = 1,
    'unapproved user can only see their own profile');

  -- ---- 005: Approved nurse: patients ----
  perform pg_temp.check_that(
    pg_temp.count_as(nurse_id, 'select count(*) from public.patients') = (select count(*) from public.patients),
    'approved nurse can read ALL patients');
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

  -- ---- 006: Rounds ----
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
  perform pg_temp.check_that(pg_temp.count_as(nurse_id, 'select count(*) from public.rounds') = base_rounds + 3,
    'the original round is still there after the correction');

  -- ---- 007: Medications and alerts ----
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.patient_meds (patient_id, drug, route, dose, freq) values ('%s','Paracetamol','IV','1 g','Every 6h')$q$, pid)) = 'ok',
    'nurse can add a medication');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.patient_meds (patient_id, drug, route) values ('%s','Aspirin','IV')$q$, pid)) like 'error%',
    'unknown drug is rejected');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id, format($q$delete from public.patient_meds where patient_id = '%s'$q$, pid)) like 'error%',
    'medications cannot be deleted (they are stopped instead)');
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
    
  -- ---- 008: Daily frequency ----
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.patient_meds (patient_id, drug, route, dose, freq) values ('%s','Tramadol','Oral','50 mg','Daily')$q$, pid)) = 'ok',
    'the Daily frequency is accepted');

  -- ---- 009: cough and physio ----
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.rounds (patient_id, kind, round_date, pain_rest, pain_move, pain_cough, pain_physio, created_by)
              values ('%s','pain', current_date, 3, 4, 5, 6, '%s')$q$, pid, nurse_id)) = 'ok',
    'cough and physiotherapy scores can be saved');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.rounds (patient_id, kind, round_date, pain_rest, pain_move, pain_cough, created_by)
              values ('%s','pain', current_date, 3, 4, 11, '%s')$q$, pid, nurse_id)) like 'error%',
    'a cough score above 10 is rejected');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.rounds (patient_id, kind, round_date, note, pain_cough, created_by)
              values ('%s','ward', current_date, 'note', 3, '%s')$q$, pid, nurse_id)) like 'error%',
    'a ward round cannot hold pain scores');

  -- ---- 010: medication status and history ----
  select id into mid from public.patient_meds where patient_id = pid and drug = 'Paracetamol' limit 1;
  perform pg_temp.check_that((select status from public.patient_meds where id = mid) = 'active', 'a new medication starts active');
  perform pg_temp.check_that((select started_by from public.patient_meds where id = mid) = nurse_id,
    'who added a medication is recorded automatically');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$select public.change_med_dose('%s','2 g','Every 8h','','Pain controlled')$q$, mid)) = 'ok', 'a nurse can change a dose');
  perform pg_temp.check_that((select dose from public.patient_meds where id = mid) = '2 g', 'the dose changed');
  perform pg_temp.check_that((select count(*) from public.patient_med_changes where med_id = mid) = 1,
    'the dose change was recorded in the history');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$select public.change_med_dose('%s','2 g','Every 8h','','x')$q$, mid)) like 'error%', 'an unchanged dose is rejected');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id, 'delete from public.patient_med_changes') like 'error%',
    'dose history cannot be deleted');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$select public.end_med('%s','removed','')$q$, mid)) like 'error%', 'removing an entry needs a reason');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$select public.end_med('%s','stopped','Pain controlled')$q$, mid)) = 'ok', 'a medication can be stopped');
  perform pg_temp.check_that((select ended_by from public.patient_meds where id = mid) = nurse_id,
    'who stopped a medication is recorded');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$select public.change_med_dose('%s','5 g','Daily','','x')$q$, mid)) like 'error%',
    'a stopped medication cannot be changed');

  -- ---- 011: alert acknowledgement and resolve ----
  select id into aid from public.patient_alerts where patient_id = pid and created_by = nurse_id limit 1;
  perform pg_temp.check_that(pg_temp.run_as(admin_id,
    format($q$insert into public.patient_alert_acks (alert_id) values ('%s')$q$, aid)) = 'ok', 'a user can acknowledge an alert');
  perform pg_temp.check_that(pg_temp.run_as(admin_id,
    format($q$insert into public.patient_alert_acks (alert_id) values ('%s')$q$, aid)) like 'error%', 'an alert can only be acknowledged once per person');
  perform pg_temp.check_that(pg_temp.run_as(admin_id,
    format($q$insert into public.patient_alert_acks (alert_id, user_id) values ('%s','%s')$q$, aid, nurse_id)) like 'error%',
    'nobody can acknowledge in someone else''s name');
  perform pg_temp.check_that(pg_temp.run_as(pending_id,
    format($q$insert into public.patient_alert_acks (alert_id) values ('%s')$q$, aid)) like 'error%', 'an unapproved user cannot acknowledge');
  perform pg_temp.run_as(admin_id, format($q$update public.patient_alerts set resolved_by = '%s' where id = '%s'$q$, nurse_id, aid));
  perform pg_temp.check_that((select resolved_by from public.patient_alerts where id = aid) = admin_id,
    'resolving an alert always records the real person');
  perform pg_temp.check_that((select alert_text from public.patient_alerts where id = aid) = 'Do not remove catheter',
    'the alert text is untouched');
  perform pg_temp.check_that(pg_temp.run_as(admin_id,
    format($q$update public.patient_alerts set resolved_by = '%s' where id = '%s'$q$, admin_id, aid)) like 'error%',
    'a resolved alert cannot be changed again');

  -- ---- 012: wards ----
  perform pg_temp.check_that(pg_temp.count_as(nurse_id, 'select count(*) from public.wards') >= 6, 'wards are readable and pre-filled');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id, $q$insert into public.wards (name) values ('Ward 99')$q$) = 'ok', 'any active user can add a ward');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id, $q$insert into public.wards (name) values ('ward 99 ')$q$) like 'error%',
    'a duplicate ward name (any capitalisation) is rejected');
  perform pg_temp.run_as(nurse_id, $q$update public.wards set active = false$q$);
  perform pg_temp.check_that(not exists (select 1 from public.wards where not active), 'a nurse cannot deactivate wards');
  perform pg_temp.run_as(admin_id, $q$update public.wards set active = false where name = 'Ward 99'$q$);
  perform pg_temp.check_that(exists (select 1 from public.wards where not active), 'an admin can deactivate a ward');

  -- ---- 013: shifts ----
  select id into tid from public.shift_templates where name = 'Day';
  perform pg_temp.check_that(pg_temp.count_as(nurse_id, 'select count(*) from public.shift_templates') = 2, 'shift templates are readable and pre-filled');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    $q$insert into public.shift_templates (name, start_time, end_time) values ('X','01:00','02:00')$q$) like 'error%',
    'a nurse cannot create shift templates');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.shift_assignments (shift_date, template_id, assignee_name) values (current_date, '%s', 'Dr Outside')$q$, tid)) = 'ok',
    'an active user can assign a shift');
  perform pg_temp.check_that((select assigned_by from public.shift_assignments where shift_date = current_date and template_id = tid) = nurse_id,
    'who assigned a shift is recorded automatically');
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    format($q$insert into public.shift_assignments (shift_date, template_id) values (current_date, '%s')$q$, tid)) like 'error%',
    'only one assignment per shift per day');
  perform pg_temp.check_that(pg_temp.run_as(pending_id,
    format($q$insert into public.shift_assignments (shift_date, template_id) values (current_date + 1, '%s')$q$, tid)) like 'error%',
    'an unapproved user cannot assign shifts');

  -- ---- 014: export log ----
  perform pg_temp.check_that(pg_temp.run_as(nurse_id,
    $q$insert into public.export_log (kind, row_count) values ('patients_csv', 1)$q$) like 'error%', 'a nurse cannot export data');
  perform pg_temp.check_that(pg_temp.run_as(admin_id,
    $q$insert into public.export_log (kind, row_count) values ('patients_csv', 1)$q$) = 'ok', 'an admin export is logged');
  perform pg_temp.check_that(pg_temp.count_as(nurse_id, 'select count(*) from public.export_log') = 0, 'a nurse cannot read the export log');

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
