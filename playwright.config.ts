import { defineConfig, devices } from '@playwright/test'

// The end-to-end tests run against a MOCK backend (see e2e/mockBackend.ts),
// so they need no Supabase project and touch no real data.
// First time only: run  npx playwright install  to download the test browsers.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', serviceWorkers: 'block' },
  projects: [
    { name: 'Pixel', use: { ...devices['Pixel 7'] } },
    { name: 'iPhone', use: { ...devices['iPhone 13'] } }, // uses WebKit
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: 'https://mock.supabase.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mock' },
  },
})
