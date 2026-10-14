import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// In managed environments a Chromium is preinstalled; elsewhere CI installs the pinned Playwright browser.
const preinstalled = '/opt/pw-browsers/chromium';
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync(preinstalled) ? preinstalled : undefined);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: { ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] },
  },
  webServer: {
    command: 'node tests/e2e/serve.mjs',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
