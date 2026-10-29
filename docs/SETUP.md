# Setup guide: from the zip to a working app on your phone

Follow the parts in order. Each part ends with a **checkpoint**: do not move on until it is true.
Use **fake patients only** until `docs/SECURITY.md` is complete.

---

## Part A. Install the tools (15 minutes)

1. **Node.js 22 or 24 (LTS)** from nodejs.org. Open a new terminal and check `node -v`. It must show `v22.12` or higher.
2. **VS Code** (code.visualstudio.com) and **Git** (git-scm.com).
3. Unzip the project to a short path **without spaces**, for example `D:\Projects\paintracker`.
4. Open that folder in VS Code (**File → Open Folder**) and open its terminal (**Terminal → New Terminal**).
   Use this terminal for every command below.

**Checkpoint:** `node -v` shows v22.12 or higher, and the terminal's current folder is the project folder (you can see `package.json` with `dir` or `ls`).

## Part B. Install and check the code (5 minutes)

```bash
npm install
npm run typecheck
npm test
```

You should see `39 passed`. This proves the logic (validation, offline queue, corrections) works on your computer.

Optional but recommended (about 3 minutes):

```bash
npx playwright install
npm run test:e2e
```

This opens a real browser at phone sizes and clicks through the app against a **pretend** backend. All tests should pass.
(The iPhone tests need the WebKit browser; `npx playwright install` downloads it.)

**Checkpoint:** unit tests pass.

## Part C. Create the Supabase project (10 minutes)

> If you used the older single-file version of this app, **do not reuse its Supabase project**. It has open tables and its key was in the files. Create a new one and delete or pause the old one.

1. Go to **supabase.com/dashboard** and sign in (GitHub login is easiest).
2. Create an organization if asked (Free plan is fine for testing).
3. **New project**: name `paintracker-dev`; click **Generate a password** and **save it in a password manager now**; choose the nearest allowed region; create it and wait about two minutes.
4. In the left sidebar open **Project Settings** (gear), then **API Keys**. Copy the **Project URL** (`https://xxxx.supabase.co`) and the **Publishable key** (starts `sb_publishable_`).
   - Do **not** copy the *secret* key anywhere near this app.
   - If your project only shows "legacy" keys, use the `anon` key for now; Supabase is retiring it, so create the new keys when offered.

**Checkpoint:** you have the project URL and the publishable key written down.

## Part D. Build the database (15 minutes)

All of these happen in the dashboard's **SQL Editor** (left sidebar, terminal icon `>_`) for the **new** project. Check the project name at the top left before you paste anything.

For each file in `supabase/migrations/`, **in this order**:
`001_profiles.sql`, `002_patients.sql`, `003_rounds.sql`, `004_audit.sql`, `005_security.sql`, `006_realtime.sql`, `007_profile_names.sql`

1. SQL Editor → **New query**.
2. Open the file in VS Code, select all, copy.
3. Paste into the editor and click **Run** (or Ctrl+Enter).
4. You should see **Success. No rows returned**. If you see an error, read it, fix the cause, and run **that file only** again. Never skip a file.

> Run all seven **before** you create any user. A user created earlier has no profile row (see Troubleshooting).

Now the security test:

1. New query, paste the whole of `supabase/tests/rls_test.sql`, Run.
2. Open the result's **Messages / Notices** area. You should see many lines starting `PASS:` and finally **`ALL SECURITY TESTS PASSED`**.
3. The test creates temporary fake users and **rolls everything back**, so nothing is left behind. If it stops with `FAIL: ...` the message says which rule is broken. Do not continue until it passes.
   (It was verified on a normal PostgreSQL; if your Supabase editor complains about the very first lines, send the message to whoever supports you before continuing.)

**Checkpoint:** Table Editor lists `profiles`, `patients`, `patient_meds`, `patient_alerts`, `rounds`, `audit_log`, and the security test passed.

## Part E. Login settings and your admin account (10 minutes)

1. **Authentication** (left sidebar) → find the sign-in/provider settings. Turn **off** "Allow new users to sign up" (so strangers cannot make accounts) and set the minimum password length to **12**. (Dashboard menus move around; use the search box at the top if you cannot find them.)
2. **Authentication → Users → Add user → Create new user.** Enter your email and a long password, and tick **Auto Confirm User**. Save the password in your password manager.
3. Make yourself the administrator. SQL Editor → New query:

```sql
update public.profiles
set role = 'admin', active = true, full_name = 'Your Name'
where id = (select id from auth.users where email = 'you@example.com');
```

Use your own email and name. It should say `UPDATE 1`. If it says `UPDATE 0`, see Troubleshooting ("no profile").

**Checkpoint:** `select role, active from public.profiles;` shows you as `admin`, `true`.

## Part F. Connect the app and sign in (5 minutes)

1. In the project folder copy `.env.example` to `.env.local` (in the VS Code Explorer: right-click, Copy, Paste, rename). **Do not rename it back to `.env.example`.**
2. Fill in the two lines with **no quotes and no spaces around `=`**:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
```

3. `git status` (if you use Git) must **not** list `.env.local`.
4. Start the app:

```bash
npm run dev
```

5. Open **http://localhost:5173**, sign in with the email and password from Part E. After editing `.env.local` you must stop (Ctrl+C) and restart `npm run dev`.
6. You land on an empty **Ward board**. Tap your initials (top right) → **Your profile** and check your name.

**Checkpoint:** you see "Ward board - 0 active patients" and you are signed in.

## Part G. Try everything with fake data (15 minutes)

1. SQL Editor → paste `supabase/seed/demo_patients.sql` → Run. It adds six clearly fake patients (BHT `DEMO/...`). Refresh the app.
2. Walk through this list:
   - [ ] Board shows patients; search "0003"; tap the category tabs.
   - [ ] Open a patient: alerts, medications, chart, rounds.
   - [ ] **Pain round**: choose rest 3, movement 8. A "Severe ▲" word appears. Type SpO2 `92`: a yellow "double-check (you can still save)" box appears. Save.
   - [ ] Type SpO2 `980`: saving is refused with a clear message.
   - [ ] **Correct this round**: save a change. The old version shows under "Earlier version".
   - [ ] **Ward round** (note only).
   - [ ] **Add an alert**; notice it cannot be edited.
   - [ ] **Edit** the patient; add a medication.
   - [ ] **Discharge**, then find them under **Discharged** and return them to the board.
   - [ ] Moon/sun button in the top bar switches **light / dark** (pure white / pure black). Profile → Appearance has System / Light / Dark.
   - [ ] **Offline test:** in Chrome press F12 → Network tab → set "No throttling" to **Offline**. Save a round. You must see **"NOT YET SENT"** and a yellow banner "1 entry not yet sent". Set it back to online: it sends by itself.
   - [ ] Leave the app untouched for 5 minutes: it signs you out.
3. When finished, remove the fake patients: paste `supabase/seed/clear_demo.sql` and Run.

**Checkpoint:** every box ticked.

## Part H. Add your team (5 minutes per person)

1. Dashboard → **Authentication → Users → Add user → Create new user**, with their email, a temporary password, and **Auto Confirm User** ticked.
2. In the app, an administrator opens **Team**. The new person appears under **Waiting for approval**. Press **Approve**.
3. Tell them: sign in, open **Your profile**, **set your name**, and **change the temporary password** (12+ characters).
4. Roles: `nurse`, `resident`, `consultant`, `admin`. Today only **admin** has extra powers (Team page).
5. **When someone leaves: Deactivate them in Team. Never delete the user**; the records they made must stay linked to a person.

## Part I. Test on a real phone

**1. Layout test on your Wi-Fi (plain HTTP, no install):**
```bash
npm run dev:phone
```
- Find your computer's address: Windows `ipconfig` → "IPv4 Address" (for example `192.168.1.20`).
- Allow Node through the Windows firewall for **private** networks when asked.
- On the phone (same Wi-Fi) open `http://192.168.1.20:5173`.
- Check: text readable, buttons easy to tap, forms don't jump, dark mode, rotate the phone. Fake data only.

**2. Install test (needs HTTPS, so do Part J first).** On Android Chrome: menu → **Install app**. On iPhone Safari: **Share → Add to Home Screen**. It opens full screen with its own icon. When a new version is published, a bar says **"A new version is ready"**; tap **Update now** when you are not in the middle of a form.

## Part J. Put it online (HTTPS)

1. Create a **private** GitHub repository and push the project (the `.gitignore` already excludes `.env.local`).
   ```bash
   git init -b main
   git add .
   git commit -m "PainTracker"
   git remote add origin https://github.com/YOURNAME/paintracker.git
   git push -u origin main
   ```
   Check on github.com that `.env.local` is **not** in the file list.
2. **Cloudflare**: Workers & Pages → Create → **Pages** → Connect to Git → choose the repo.
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `NODE_VERSION` = `22`
3. After the first deploy you get an address like `https://paintracker.pages.dev`. Open it on your phone, sign in, install it (Part I.2).
4. In Supabase: **Authentication → URL Configuration**: set **Site URL** to that address.
5. Security headers come from `public/_headers`. If something is blocked after deploying, open the browser console (F12): a blocked request names the rule. If you host Supabase on your own domain, replace `*.supabase.co` in `public/_headers` with your domain.
6. Other hosts (Netlify etc.) work too, but need a rule that sends every address to `index.html`.

## Part K. Everyday administration

| Task | How |
|---|---|
| Approve a new user | App → Team → Approve |
| Deactivate a leaver or a lost phone | App → Team → Deactivate. The server stops giving them patient data immediately. |
| Forgotten password | Dashboard → Authentication → Users → open the user and use the reset/update password option. Fallback in the SQL Editor (test on a dev project first): `update auth.users set encrypted_password = crypt('new-long-temporary-password', gen_salt('bf')) where email = 'them@example.com';` then ask them to change it. |
| See who changed what | SQL Editor: `select at, actor, table_name, action from public.audit_log order by at desc limit 50;` |
| Change an allowed value (a new drug, ward type, tag) | Add a **new** numbered SQL file (`008_...sql`) that drops and re-adds the check constraint, and change `src/lib/constants.ts` to match. Never edit an old file. Re-run `rls_test.sql`. |
| Update the app | Push to GitHub; Cloudflare redeploys; phones show "A new version is ready". |
| Backups | Use a paid Supabase plan with daily backups, **and practise a restore**. |

## Part L. Troubleshooting

| You see | Cause and fix |
|---|---|
| "Setup needed: Missing VITE_SUPABASE_URL..." | `.env.local` is missing, misnamed, or not restarted. Fix, then Ctrl+C and `npm run dev` again. On Cloudflare, add the variables and redeploy. |
| "Email or password is not correct." | Wrong password, or the user is not confirmed. Recreate with **Auto Confirm User** ticked. |
| "Your account has no profile yet." | The user was created **before** migration 001. Run: `insert into public.profiles (id) select id from auth.users on conflict do nothing;` then repeat the admin update from Part E. |
| "Waiting for approval" for you | You are not yet active: run the Part E admin update, or ask an admin to approve you. |
| Board empty although patients exist | Your user is inactive, or `005_security.sql` was not run. Check `select * from public.profiles;`. |
| "permission denied for table ..." | `005_security.sql` was not run, or ran with errors. Run it again. |
| Pages do not update live | `006_realtime.sql` was not run, or Realtime is disabled for the project. |
| "Name is required" etc. on save | Normal: the form is telling you what to fix. |
| "A patient with that BHT number already exists." | BHT numbers are unique. Check the existing patient, or the number you typed. |
| Blank page after deploying | The two `VITE_` variables are missing on the host, or the build failed (check the build log and `NODE_VERSION=22`). |
| Install button never appears | You are on plain HTTP or an unsupported browser. Use the HTTPS address; on iPhone use Safari's Share menu. |
| `npm install` fails | Check `node -v` is 22.12 or higher, and that you are in the project folder. |
| "Port 5173 is already in use" | Another copy is running. Close it, or accept the next port Vite offers. |

## Part N. If patient data must stay in Sri Lanka

Supabase's hosted service has no Sri Lankan region, as far as the author knows. Ask your hospital's legal and IT offices in writing whether data may be held abroad. If not:

- **Self-host Supabase** on an in-country server using Supabase's official Docker setup (docs: supabase.com/docs/guides/self-hosting/docker). This app needs nothing else changed: you point `VITE_SUPABASE_URL` at your own domain and use the publishable key from your server, and run the same seven SQL files and the same security test.
- Host the built `dist/` on the same server, and change `*.supabase.co` in `public/_headers` to your domain.
- You then own backups, updates, disk encryption, firewalling and monitoring. Plan for that before you choose this route.
