import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const exe = path.resolve(`release/Unaltered-${pkg.version}-linux-x64/unaltered`);

let app: ElectronApplication;

test.beforeAll(async () => {
  test.skip(!existsSync(exe), `packaged app not found at ${exe}`);
  // Running as root in CI containers requires disabling the setuid sandbox; the renderer
  // sandbox flag (webPreferences.sandbox) is still asserted below.
  const args = process.getuid?.() === 0 ? ['--no-sandbox'] : [];
  app = await electron.launch({ executablePath: exe, args });
});

test.afterAll(async () => {
  await app?.close();
});

test('loads the web app from the private app:// origin', async () => {
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  expect(win.url()).toMatch(/^app:\/\/unaltered\//);
  const title = await win.title();
  expect(title.length).toBeGreaterThan(0);
});

test('renderer has no Node.js access', async () => {
  const win = await app.firstWindow();
  const leaks = await win.evaluate(() => ({
    require: typeof (globalThis as Record<string, unknown>).require,
    process: typeof (globalThis as Record<string, unknown>).process,
    module: typeof (globalThis as Record<string, unknown>).module,
  }));
  expect(leaks).toEqual({ require: 'undefined', process: 'undefined', module: 'undefined' });
  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const p = BrowserWindow.getAllWindows()[0]!.webContents.getLastWebPreferences();
    return { sandbox: p?.sandbox, contextIsolation: p?.contextIsolation, nodeIntegration: p?.nodeIntegration };
  });
  expect(prefs).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false });
});

test('blocks requests to hosts outside the allowlist at the session layer', async () => {
  const blocked = await app.evaluate(async ({ session }) => {
    try {
      await session.defaultSession.fetch('https://example.com/');
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
});

test('refuses navigation away from the app and new windows', async () => {
  const win = await app.firstWindow();
  const before = win.url();
  await win.evaluate(() => { window.location.href = 'https://example.com/'; });
  await win.waitForTimeout(500);
  expect(win.url()).toBe(before);
  await win.evaluate(() => { window.open('https://example.com/'); });
  await win.waitForTimeout(500);
  expect(app.windows().length).toBe(1);
});

test('denies permission requests', async () => {
  const win = await app.firstWindow();
  const state = await win.evaluate(async () => {
    try {
      const r = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return r.state;
    } catch {
      return 'denied';
    }
  });
  expect(state).toBe('denied');
});
