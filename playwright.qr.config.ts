import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// Same browser resolution as playwright.config.ts: preinstalled Chromium in managed environments, pinned install in CI.
const preinstalled = '/opt/pw-browsers/chromium';
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync(preinstalled) ? preinstalled : undefined);

export default defineConfig({
  testDir: 'tests/qualification', timeout: 180_000, workers: 1, retries: 0,
  reporter: [['list']],
  use: {
    browserName: 'chromium', baseURL: 'http://127.0.0.1:4173',
    launchOptions: { ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] },
  },
  webServer: { command: 'node tests/e2e/serve.mjs', url: 'http://127.0.0.1:4173/index.html', reuseExistingServer: false },
});
