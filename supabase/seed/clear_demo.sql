-- Removes ONLY the demo patients (BHT starting with DEMO/) and everything attached to them.
-- Run in the SQL Editor (it runs as the database owner, so the normal "no delete" rules do not apply).
-- The audit log keeps its record of what happened.
delete from public.patient_meds   where patient_id in (select id from public.patients where bht like 'DEMO/%');
delete from public.patient_alerts where patient_id in (select id from public.patients where bht like 'DEMO/%');
-- break amendment links first, then rounds
update public.rounds set amended_of = null where patient_id in (select id from public.patients where bht like 'DEMO/%');
delete from public.rounds         where patient_id in (select id from public.patients where bht like 'DEMO/%');
delete from public.patients       where bht like 'DEMO/%';
