# Architecture V2 — UI development baseline

Based on PainTracker-Architecture.zip. Existing feature screens, CSS, migrations, package manifest and lockfile are retained. Imports have been redirected to the new layers; legacy paths re-export the relocated implementations.

- `src/app`: router, query client and patient use-case composition.
- `src/domain`: clinical calculations, models and form validation. Models still use generated database types as type-only dependencies.
- `src/application`: patient repository contract and use cases; injected round synchronization policy.
- `src/infrastructure`: Supabase client/types, patient and shift repositories, Dexie storage, outbox adapter and export helpers.
- `src/shared`: common UI and error helpers.
- `src/features`: feature screens and hooks.
- `src/styles/tokens.css`, `app.css`: design tokens and styling. Start UI/UX changes here and in feature screens/shared components, not compatibility re-exports.

The outbox database name, schema, retry behavior, ordering and duplicate handling are unchanged. Existing auth, RLS, audit behavior, query keys and native configuration are retained. Some feature screens still call Supabase directly; full repository coverage, native storage adapters, enhanced security, conflict resolution, retry changes and query optimization are deferred pending regression tests and separate approval. No claim of clinical equivalence is made.

## Verification
TypeScript application and node configuration checks passed using available TypeScript 5.8.3 and existing dependency declarations. Vitest startup failed because available dependencies contain Windows-only native Rolldown bindings. Production build, Playwright, Android and iOS runtime not verified. CI workflow added, not executed. Use a clean npm ci on your machine, preserve lockfile, copy .env.local privately, and test against mock or non-production data. Retain the working Android Java 21 configuration. Do not replace the working project until regression tests pass.
