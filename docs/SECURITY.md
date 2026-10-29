# Security notes

## What protects what

| Rule | Where it is enforced | Checked by |
|---|---|---|
| Logged-out visitors can read or write nothing | Database (permissions + Row Level Security) | `supabase/tests/rls_test.sql` |
| New users see nothing until an admin approves them | Database | `rls_test.sql` |
| Nobody can delete patients, rounds or alerts; rounds and alerts cannot be edited | Database | `rls_test.sql` |
| You cannot add a record in someone else's name | Database | `rls_test.sql` |
| Only admins change roles or approval; anyone may rename only themselves | Database (policy + trigger) | `rls_test.sql` |
| The audit log records every change; nobody can edit or delete it | Database | `rls_test.sql` |
| Impossible values (age 200, SpO2 980, unknown drug) are rejected | Database **and** the form | `rls_test.sql`, `npm test` |
| Sign-out after 5 minutes idle | The app | `npm run test:e2e` |
| Patient data is never stored in the service-worker cache | App configuration (`vite.config.ts`) | Code review |

**Important:** screens hiding a button is only politeness. The real protection is the database
rules. Re-run `rls_test.sql` after any change to the SQL files.

## The key in the browser

`VITE_SUPABASE_PUBLISHABLE_KEY` is **meant to be public** (it ships to every phone). It is safe
only because the database rules above refuse anything the signed-in user may not do.
**Never** put the Supabase *secret* key (or the old `service_role` key) in this app, in Git, or in a chat.
If a secret key ever leaks, create a new one in the Supabase dashboard (API Keys), switch over, delete the old one.

## Before any real patient is entered

- [ ] Written approval from the hospital, including **where the data may be stored**
      (Sri Lanka's data protection rules for health data come into force on 1 January 2027; ask your Data Protection Officer).
- [ ] If data must stay in Sri Lanka, self-host Supabase in-country (see `docs/SETUP.md`, Part N).
- [ ] A **paid** Supabase plan (or a properly run self-hosted server) with daily backups, and a **restore you have actually practised**.
- [ ] Turn on multi-factor sign-in for admins (Supabase Auth settings).
- [ ] `rls_test.sql` shows "ALL SECURITY TESTS PASSED" on the production project.
- [ ] A written process: who approves users, who deactivates leavers, what to do about a lost phone
      (deactivate that user at once: the server then returns no patient data to them).
- [ ] A data retention and purge rule agreed with the hospital.
- [ ] A pilot with fake patients and a few staff for a few weeks. Fix what they find.
- [ ] A screen lock on every phone that will be used.

## Things not verified by the author

- `rls_test.sql` was run against a normal PostgreSQL with stand-ins for Supabase's login tables,
  not against a live Supabase project. Run it on yours (Setup Part D) to confirm.
- Browser tests used a pretend backend and Chromium. No real iPhone or Android phone was used.
- Realtime live updates need Supabase Realtime enabled for the four tables (migration 006).
