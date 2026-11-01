import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * The app is a static Next.js client that talks to Supabase directly, so these
 * tests drive the real browser against a running dev/prod server. Authenticated
 * tests read `E2E_EMAIL` / `E2E_PASSWORD` from the environment and skip when
 * they are absent; credentials are never written to the repository or reports.
 *
 * Uses the installed Microsoft Edge because the bundled Playwright browser may
 * not match the pinned version on this machine.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
    env: { NEXT_TELEMETRY_DISABLED: '1' },
  },
});
