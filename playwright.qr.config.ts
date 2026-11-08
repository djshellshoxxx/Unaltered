import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/qualification', timeout: 180_000, workers: 1, retries: 0,
  reporter: [['list']],
  use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:4173' },
  webServer: { command: 'node tests/e2e/serve.mjs', url: 'http://127.0.0.1:4173/index.html', reuseExistingServer: false },
});
