# Decisions and why

| Decision | Why |
|---|---|
| React + TypeScript + Vite | TypeScript catches wrong field names before they reach a patient record. Widest help and job relevance. |
| Supabase (Postgres, Auth, Row Level Security, Realtime) | Real logins and rules enforced on the **server**, live updates, free to start, can be self-hosted if data must stay in-country. |
| One database row per round, never edited | Two people can add rounds at the same time without overwriting each other, and history is kept. |
| Corrections are new rows ("amended_of") | The original stays in the record. Nothing is silently changed. |
| No delete for patients, rounds or alerts | Clinical records are not erased. Discharge is a status. Medications can be replaced (and every change is audited). |
| Wide hard limits, soft warnings | The database blocks typos (SpO2 980) but never blocks a real emergency value (SpO2 40). The form shows a warning instead. |
| The round id is made on the phone | A retry after a bad connection can never create a duplicate. |
| Offline queue holds ids and clinical values only, no names | Less sensitive data on the device. Items are tied to the signed-in user. |
| "Not yet sent" is always shown | A nurse must never believe an entry was saved when it was not. |
| PWA asks before updating | An update must not wipe a form someone is filling in. |
| Service worker never caches Supabase | Patient data is never stored in the browser cache. |
| Pure white / pure black themes | Matches phone conventions; black saves OLED battery and reduces glare at night. Status colours always come with a word or symbol ("Severe", ▲). |
| New accounts start inactive | Nobody sees patients until an admin approves them. |
| Idle sign-out after 5 minutes (counts background time) | Phones get locked and left on desks. |
