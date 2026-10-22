import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// In managed environments a Chromium is preinstalled; elsewhere CI installs the pinned Playwright browser.
const preinstalled = '/opt/pw-browsers/chromium';
const browserName = process.env.UNALTERED_BROWSER ?? 'chromium';
if (browserName !== 'chromium' && browserName !== 'firefox' && browserName !== 'webkit') {
  throw new Error('UNALTERED_BROWSER must be chromium, firefox or webkit.');
}
const executablePath = browserName === 'chromium'
  ? process.env.CHROMIUM_PATH ?? (existsSync(preinstalled) ? preinstalled : undefined)
  : browserName === 'webkit' ? process.env.WEBKIT_PATH : process.env.FIREFOX_PATH;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    browserName,
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: { ...(executablePath ? { executablePath } : {}), ...(browserName === 'chromium' ? { args: ['--no-sandbox'] } : {}) },
  },
  webServer: {
    command: 'node tests/e2e/serve.mjs',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
