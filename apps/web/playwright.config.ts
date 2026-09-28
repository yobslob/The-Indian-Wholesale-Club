import { existsSync } from 'node:fs';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { E2E_ADMIN } from './e2e/env';

/**
 * E2E smoke tests (engineering.md §Testing): three flows against a production build
 * (`next build` first; `node scripts/check.mjs build e2e` does both) on LOCAL Supabase.
 * Reads apps/web/.env.local like Next.js does; e2e/env.ts refuses non-local databases
 * and live Stripe keys.
 */
for (const file of ['.env.local', '.env']) {
  // Earlier files win: loadEnvFile never overwrites a variable that is already set.
  const full = path.join(__dirname, file);
  if (existsSync(full)) process.loadEnvFile(full);
}

const PORT = 3101;
const adminEmails = [process.env.ADMIN_EMAILS, E2E_ADMIN.email].filter(Boolean).join(',');

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  // One worker: the tests share one local database and one server.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  forbidOnly: true,
  reporter: [['list']],
  outputDir: '../../.checks/e2e-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 90_000,
    env: {
      // The e2e admin is allowed only for this server process (INV-7 needs the env list too).
      ADMIN_EMAILS: adminEmails,
      // Emails stay in the outbox during tests (the addresses are *.test anyway).
      RESEND_API_KEY: '',
    },
  },
});
