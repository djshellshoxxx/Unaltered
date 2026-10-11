import { defineConfig } from '@playwright/test';

// Desktop shell smoke tests (ADR-008). Requires a packaged Linux build:
//   npm run build && node scripts/build-windows.mjs --platform linux
// and a display (CI: xvfb-run).
export default defineConfig({
  testDir: 'tests/desktop',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
});
