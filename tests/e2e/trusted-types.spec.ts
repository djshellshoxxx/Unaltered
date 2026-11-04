// SR-1 / Q7: the shipped CSP requires Trusted Types for script sinks and allows only the app's own worker policy.
// These tests check that the policy is delivered with both builds and, in engines that implement Trusted Types, that
// it is actually enforced. Engines without the API cannot enforce it; the test is reported as skipped rather than
// passed (the delivery checks still run first), so a run on such an engine is not evidence of enforcement.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { bytesOf, cspViolations, watchViolations } from './helpers';

interface SinkProbe {
  supported: boolean;
  html: string;
  htmlUnchanged: boolean;
  foreignPolicy: string;
  stringWorker: string;
}

const NOTE = bytesOf('trusted types probe\n');
const NOT_EVIDENCED = 'Trusted Types not implemented by this engine; enforcement not evidenced';

async function cspOf(page: Page): Promise<string> {
  return page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content').then((v) => v ?? '');
}

/** Tries each script sink with plain strings. Returns the error name each attempt raised, or 'allowed'. */
async function probeSinks(page: Page): Promise<SinkProbe> {
  return page.evaluate(() => {
    const outcome = (fn: () => unknown): string => {
      try { fn(); return 'allowed'; } catch (e) { return e instanceof Error ? e.name : 'thrown'; }
    };
    const tt = (globalThis as { trustedTypes?: { createPolicy(n: string, r: object): unknown } }).trustedTypes;
    const host = document.createElement('div');
    const html = outcome(() => { host.innerHTML = '<img src=x>'; });
    return {
      supported: tt !== undefined,
      html,
      htmlUnchanged: host.childNodes.length === 0,
      foreignPolicy: outcome(() => tt?.createPolicy('injected', { createHTML: (s: string) => s })),
      // The URL is never fetched: Trusted Types rejects the plain string before the request.
      stringWorker: outcome(() => new Worker('./not-a-real-worker.js')),
    };
  });
}

function expectEnforced(probe: SinkProbe): void {
  expect(probe.html).toBe('TypeError');
  expect(probe.htmlUnchanged).toBe(true);
  expect(probe.foreignPolicy).toBe('TypeError');
  expect(probe.stringWorker).toBe('TypeError');
}

test.describe('Trusted Types (SR-1, Q7)', () => {
  // The titles claim enforcement, so a test here may end 'passed' only with that evidence. The list reporter does
  // not print annotations: anything else would show a green check for a probe that never ran.
  test.afterEach(() => {
    const info = test.info();
    if (info.status !== 'passed') return;
    expect(info.annotations, 'passed without evidencing enforcement')
      .toContainEqual({ type: 'trusted-types', description: 'enforced' });
  });

  test('multi-file build delivers and enforces the Trusted Types policy', async ({ page }, info) => {
    const viol = await watchViolations(page);
    await page.goto('/index.html');
    const policy = await cspOf(page);
    expect(policy).toContain("require-trusted-types-for 'script'");
    expect(policy).toContain('trusted-types unaltered-worker');
    // The app's own worker policy must keep working under enforcement.
    await page.setInputFiles('#stamp-file', { name: 'tt.txt', mimeType: 'text/plain', buffer: NOTE });
    await expect(page.locator('.digest').first()).toBeVisible();
    expect(await cspViolations(page)).toEqual([]);
    expect(viol.list).toEqual([]);

    const probe = await probeSinks(page);
    test.skip(!probe.supported, NOT_EVIDENCED);
    expectEnforced(probe);
    // Once the app has created its policy, a second policy with the same name is refused (no 'allow-duplicates').
    const duplicate = await page.evaluate(() => {
      try {
        (globalThis as unknown as { trustedTypes: { createPolicy(n: string, r: object): unknown } })
          .trustedTypes.createPolicy('unaltered-worker', { createScriptURL: (s: string) => s });
        return 'allowed';
      } catch (e) { return e instanceof Error ? e.name : 'thrown'; }
    });
    expect(duplicate).toBe('TypeError');
    info.annotations.push({ type: 'trusted-types', description: 'enforced' });
  });

  test('offline single-file build delivers and enforces the Trusted Types policy', async ({ browser }, info) => {
    const ctx = await browser.newContext({ offline: true });
    const page = await ctx.newPage();
    const viol = await watchViolations(page);
    const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;
    await page.goto(`${pathToFileURL(resolve('dist', `unaltered-${version}.html`)).href}#stamp`);
    const policy = await cspOf(page);
    expect(policy).toContain("require-trusted-types-for 'script'");
    expect(policy).toContain('trusted-types unaltered-worker');
    await page.setInputFiles('#stamp-file', { name: 'tt.txt', mimeType: 'text/plain', buffer: NOTE });
    await expect(page.locator('.digest').first()).toBeVisible();
    expect(await cspViolations(page)).toEqual([]);
    expect(viol.list).toEqual([]);
    const probe = await probeSinks(page);
    await ctx.close();
    test.skip(!probe.supported, NOT_EVIDENCED);
    expectEnforced(probe);
    info.annotations.push({ type: 'trusted-types', description: 'enforced' });
  });
});
