// Opt-in LIVE qualification of the R1 liveness canary (ADR-014). No route mocks: the built app, under its own CSP,
// looks up a synthetic random pending commitment (unknown to the calendars, so their 404 lacks ACAO and is unreadable),
// then each calendar's fixed public canary. Passing means every built-in calendar's canary was browser-readable and
// parsed as the recorded completed timestamp. It submits nothing and sends no user data.
//
//   npm run build && UNALTERED_LIVE_LIVENESS=1 npx playwright test tests/e2e/liveness-live.spec.ts --retries=0
//
// Needs a network path that reaches the three calendars (CI network-check job). Skipped otherwise.
import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { serializeProof } from '../../src/core/ots/codec';
import { LIVENESS_CANARIES } from '../../src/core/ots/liveness';
import { TABLES } from '../../src/ui/strings';

test.skip(process.env.UNALTERED_LIVE_LIVENESS !== '1', 'live calendars: set UNALTERED_LIVE_LIVENESS=1 on a host that can reach them');

test('every built-in calendar answers its canary readably in a real browser', async ({ page, browserName }, testInfo) => {
  test.setTimeout(120_000);
  const digest = new Uint8Array(randomBytes(32));
  const receipt = serializeProof({ digest, root: { msg: digest, children: [], attestations: LIVENESS_CANARIES.map((c) => ({ kind: 'pending' as const, uri: c.base })) } });
  const requests: { host: string; path: string; status: number | null; acao: string | null; failure: string | null }[] = [];
  const observations: Promise<void>[] = [];
  const calendarHosts = new Set(LIVENESS_CANARIES.map((c) => new URL(c.base).host));
  page.on('requestfinished', (req) => {
    if (!calendarHosts.has(new URL(req.url()).host)) return;
    observations.push((async () => {
      const res = await req.response();
      const u = new URL(req.url());
      requests.push({ host: u.host, path: u.pathname, status: res?.status() ?? null, acao: res ? await res.headerValue('access-control-allow-origin') : null, failure: null });
    })());
  });
  page.on('requestfailed', (req) => {
    const u = new URL(req.url());
    if (!calendarHosts.has(u.host)) return;
    requests.push({ host: u.host, path: u.pathname, status: null, acao: null, failure: req.failure()?.errorText ?? 'failed' });
  });
  const items = page.locator('.upgrade-liveness li');
  let ok = false;
  try {
    await page.goto('/index.html#verify');
    await page.setInputFiles('#upgrade-receipt', { name: 'live.ots', mimeType: 'application/octet-stream', buffer: Buffer.from(receipt) });
    await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();
    await expect(items).toHaveCount(LIVENESS_CANARIES.length, { timeout: 90_000 });
    await expect(items).toHaveText(LIVENESS_CANARIES.map((c) => TABLES.en['upgrade.liveness.reachable'].replace('{host}', new URL(c.base).host)));
    ok = true;
  } finally {
    // Preserve negative evidence too. Network failure must never disappear behind a missing success-only log.
    await Promise.allSettled(observations);
    const evidence = {
      checkedAt: new Date().toISOString(),
      sourceSha: process.env.GITHUB_SHA ?? null,
      browserName,
      browserVersion: page.context().browser()?.version() ?? null,
      scope: 'Calendar reachability only; no user receipt confirmation or independent Bitcoin verification.',
      expectedHosts: [...calendarHosts],
      displayedResults: await items.allTextContents().catch(() => []),
      requests,
      ok,
    };
    const report = JSON.stringify(evidence, null, 2);
    console.log(report);
    await testInfo.attach('calendar-liveness-evidence', { body: report, contentType: 'application/json' });
  }
});
