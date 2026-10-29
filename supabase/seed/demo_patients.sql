-- =====================================================================
-- FAKE DEMO DATA for trying the app. NEVER run this on a real system.
-- Run in the SQL Editor AFTER you have made yourself admin (Phase 5).
-- Every demo patient has a BHT starting with DEMO/ so it is easy to remove
-- (see clear_demo.sql).
-- =====================================================================
do $$
declare
  admin_id uuid;
  p1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid(); p3 uuid := gen_random_uuid();
  p4 uuid := gen_random_uuid(); p5 uuid := gen_random_uuid(); p6 uuid := gen_random_uuid();
begin
  select id into admin_id from public.profiles where role = 'admin' and active order by created_at limit 1;
  if admin_id is null then
    raise exception 'No active admin found. Make yourself admin first (see the setup guide, Phase 5).';
  end if;

  insert into public.patients (id, bht, full_name, age, sex, ward, category, surgery, indication, surgery_date, surgery_time,
                               anaesthesia_mode, has_epidural, ep_level, ep_inserted_date, ep_inserted_time, ep_test_dose, created_by)
  values (p1, 'DEMO/0001', 'Demo Patient One', 61, 'M', '7A', 'Surgery', 'Incisional hernia repair', 'ASA 2',
          current_date - 3, '09:30', 'GA', true, 'T11-T12', current_date - 3, '08:50', '3 ml lignocaine 2%', admin_id);

  insert into public.patients (id, bht, full_name, age, sex, ward, category, surgery, indication, surgery_date, anaesthesia_mode,
                               has_nerve_catheter, nv_type, nv_inserted_date, nv_inserted_time, created_by)
  values (p2, 'DEMO/0002', 'Demo Patient Two', 47, 'F', '23B', 'Surgery', 'Shoulder arthroscopy', 'Rotator cuff tear',
          current_date - 1, 'GA', true, 'Supraclavicular', current_date - 1, '07:40', admin_id);

  insert into public.patients (id, bht, full_name, age, sex, ward, category, category_note, surgery, surgery_date, anaesthesia_mode,
                               has_pca, pca_drug, pca_bolus, pca_lockout, pca_max_hr, created_by)
  values (p3, 'DEMO/0003', 'Demo Patient Three', 72, 'F', 'ICU', 'Surgery', null, 'Colectomy', current_date - 2, 'GA',
          true, 'Morphine', '1 mg', '5 min', '8 mg', admin_id);

  insert into public.patients (id, bht, full_name, age, sex, ward, category, category_note, created_by)
  values (p4, 'DEMO/0004', 'Demo Patient Four', 34, 'M', '7A', 'Difficult airway', 'Grade 4 view, awake fibreoptic needed', admin_id);

  insert into public.patients (id, bht, full_name, age, sex, ward, category, category_note, created_by)
  values (p5, 'DEMO/0005', 'Demo Patient Five', 29, 'F', '39', 'Anaphylaxis', 'Rocuronium reaction, allergy clinic follow-up', admin_id);

  insert into public.patients (id, bht, full_name, age, sex, ward, category, surgery, surgery_date, anaesthesia_mode, status, discharged_date, created_by)
  values (p6, 'DEMO/0006', 'Demo Patient Six (discharged)', 55, 'M', '23B', 'Surgery', 'Knee arthroplasty', current_date - 8, 'Spinal',
          'discharged', current_date - 2, admin_id);

  insert into public.patient_meds (patient_id, sort_order, drug, route, dose, freq, dosing) values
    (p1, 0, 'Paracetamol', 'IV', '1 g', 'Every 6h', 'single'),
    (p1, 1, 'Tramadol', 'IV', '100 mg', 'Every 8h', 'single'),
    (p2, 0, 'Paracetamol', 'Oral', '1 g', 'Every 6h', 'single'),
    (p2, 1, 'Pregabalin', 'Oral', '75 mg', 'Every 12h', 'single'),
    (p3, 0, 'Paracetamol', 'IV', '1 g', 'Every 6h', 'single');

  insert into public.patient_alerts (patient_id, alert_text, created_by) values
    (p1, 'Suspected catheter migration - do NOT give further boluses. Keep catheter until reviewed.', admin_id),
    (p4, 'Difficult airway: videolaryngoscope and bougie must be in theatre.', admin_id),
    (p5, 'Rocuronium anaphylaxis - avoid all steroidal neuromuscular blockers.', admin_id);

  insert into public.rounds (patient_id, kind, round_date, round_time, session, pain_rest, pain_move, rr, spo2, hr, bp_sys, bp_dia, gcs, mobilization, tags, note, created_by) values
    (p1, 'pain', current_date - 2, '08:10', 'Morning', 2, 5, 16, 98, 78, 124, 76, 15, 'Mobilized', '{}', 'Comfortable at rest.', admin_id),
    (p1, 'pain', current_date - 2, '18:20', 'Evening', 3, 6, 18, 97, 84, 130, 80, 15, 'Mobilized', '{}', null, admin_id),
    (p1, 'pain', current_date - 1, '08:05', 'Morning', 4, 7, 18, 96, 92, 138, 84, 15, 'Not mobilized', array['Top-up given'], 'Movement pain high, top-up given.', admin_id),
    (p1, 'pain', current_date,     '08:00', 'Morning', 3, 4, 16, 98, 80, 126, 78, 15, 'Mobilized', '{}', 'Better after top-up.', admin_id),
    (p2, 'pain', current_date,     '08:30', 'Morning', 2, 3, 14, 99, 70, 118, 72, 15, 'Mobilized', '{}', 'Block working well.', admin_id),
    (p3, 'pain', current_date - 1, '09:00', 'Morning', 5, 8, 20, 95, 98, 142, 88, 14, 'Not mobilized', array['Urgent review','Dose changed'], 'PCA demand high, reviewing dose.', admin_id),
    (p3, 'pain', current_date,     '09:10', 'Morning', 3, 5, 18, 96, 88, 130, 80, 15, 'Not mobilized', '{}', null, admin_id),
    (p4, 'ward', current_date,     '10:00', null, null, null, null, null, null, null, null, null, null, '{}', 'Airway plan reviewed with theatre team.', admin_id);
end $$;
