# DP M&R: pain management ward round record

A phone-first web app for pain-management ward rounds: ward board, patient pages, pain scores
with trend chart, vitals, medications, alerts, corrections with history, offline-safe saving,
light/dark mode, installable on a phone. Built with React, TypeScript, Vite and Supabase.

> **Use FAKE patients only** until your hospital has approved this system and you have finished
> `docs/SECURITY.md`. This is not a certified medical device.

## Start here

1. Read **`docs/SETUP.md`** and follow it top to bottom (about 60-90 minutes the first time).
2. Quick version, once Supabase is set up:

```bash
npm install
cp .env.example .env.local     # then fill in the two values
npm run dev                    # http://localhost:5173
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Run on your computer |
| `npm run dev:phone` | Same, reachable from a phone on your Wi-Fi |
| `npm run build` | Check types and make the production build in `dist/` |
| `npm test` | 39 logic tests (validation, offline queue, dates, corrections) |
| `npm run test:e2e` | 20 browser tests per phone size, against a **pretend** backend |
| `npm run types` | Regenerate `src/lib/database.types.ts` from your Supabase project |

First time for browser tests: `npx playwright install`.

## What is in the folders

```
supabase/migrations/   7 SQL files that build the database and its security rules (run in order)
supabase/tests/        rls_test.sql: 51 security checks you can run any time
supabase/seed/         FAKE demo patients (and a script to remove them)
src/lib/               types, validation helpers, dates, blood pressure, vitals, the offline queue
src/features/          auth, patients, rounds, admin, profile (one folder per area)
src/components/        layout, buttons/fields, pain scale, banners
src/styles/            tokens.css (colours, light and dark) and app.css
e2e/                   browser tests + the pretend backend
public/                icons and security headers (_headers)
docs/                  SETUP.md, SECURITY.md, DECISIONS.md
```

## Known limits (be aware)

- Only **rounds** can be saved while offline. Adding or editing a patient needs a connection.
- Creating or editing a patient is several requests, not one transaction. If a later step fails
  you get a clear warning and can fix it with Edit.
- Two people editing the **same patient record** at the same moment: the last save wins
  (rounds and alerts are separate rows, so those never overwrite each other).
- Roles (nurse / resident / consultant) are labels for now. Only **admin** has extra powers.
- The board loads every active patient and their rounds in one go. Fine for tens of patients;
  it would need paging for hundreds.
- No push notifications or fingerprint login (a native wrapper such as Capacitor could add them).
- The browser tests were run on Chromium (Pixel 7 screen). The iPhone/WebKit variant is included
  but was not run by the author.
