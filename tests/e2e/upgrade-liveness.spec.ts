// R1 liveness canary in a real browser under the app's CSP (ADR-014). Pending lookups are CORS-blocked exactly as on
// the live calendars (see installNetwork); the fixed canary lookups are routed per scenario. Mocked routes only.
import { expect, test, type BrowserContext, type Route } from '@playwright/test';
import { sha256 } from '@noble/hashes/sha2.js';
import { concat, fromHex } from '../../src/core/bytes';
import { serializeProof, serializeTree } from '../../src/core/ots/codec';
import { LIVENESS_CANARIES } from '../../src/core/ots/liveness';
import type { TsNode } from '../../src/core/ots/types';
import { TABLES } from '../../src/ui/strings';
import { installNetwork } from './helpers';

const CORS = { 'access-control-allow-origin': '*' };
const HOSTS = LIVENESS_CANARIES.map((c) => new URL(c.base).host);
const PENDING_UPGRADE_NOTICE = 'Not confirmed yet. Try again in a few hours.';
const UNREADABLE_UPGRADE_NOTICE = 'This browser could not read the answer from one or more calendar servers. '
  + 'This may be a pending reply that the browser is not allowed to read, or a network problem. '
  + 'Your receipt is still pending. Check again later.';

/** Synthetic pending receipt naming all three built-in calendars; no calendar submission is involved. */
function pendingReceipt(): Buffer {
  const digest = sha256(new TextEncoder().encode('liveness e2e'));
  const nonce = new Uint8Array(16).fill(3);
  const appended = concat(digest, nonce);
  const node: TsNode = { msg: sha256(appended), attestations: LIVENESS_CANARIES.map((c) => ({ kind: 'pending' as const, uri: c.base })), children: [] };
  const root: TsNode = { msg: digest, attestations: [], children: [{ op: { kind: 'append', arg: nonce }, node: {
    msg: appended, attestations: [], children: [{ op: { kind: 'sha256' }, node }] } }] };
  return Buffer.from(serializeProof({ digest, root }));
}

/** A complete reply for the canary commitment at its recorded height, from synthetic operations only. */
function completeReply(hex: string, height: number): Buffer {
  const msg = fromHex(hex);
  const extra = Uint8Array.of(4, 4);
  const appended = concat(msg, extra);
  const end: TsNode = { msg: sha256(appended), attestations: [{ kind: 'bitcoin', height }], children: [] };
  const mid: TsNode = { msg: appended, attestations: [], children: [{ op: { kind: 'sha256' }, node: end }] };
  return Buffer.from(serializeTree({ msg, attestations: [], children: [{ op: { kind: 'append', arg: extra }, node: mid }] }));
}

type Canary = 'readable' | 'blocked' | 'malformed';

/** Routes each calendar's canary lookup; every other request falls through to installNetwork. Returns canary hits. */
async function routeCanaries(ctx: BrowserContext, plan: Record<string, Canary>): Promise<string[]> {
  const hits: string[] = [];
  for (const c of LIVENESS_CANARIES) {
    const host = new URL(c.base).host;
    await ctx.route(`${c.base}/timestamp/${c.commitment}`, (route: Route) => {
      hits.push(host);
      const mode = plan[host];
      if (mode === 'readable') return route.fulfill({ status: 200, headers: CORS, body: completeReply(c.commitment, c.height) });
      if (mode === 'malformed') return route.fulfill({ status: 200, headers: CORS, body: '<html>maintenance</html>' });
      return route.fulfill({ status: 404, headers: { 'access-control-allow-origin': 'https://other.invalid' }, body: 'Not found' });
    });
  }
  return hits;
}

const line = (lang: 'en' | 'es', state: 'reachable' | 'unreachable' | 'unknown', host: string): string =>
  TABLES[lang][`upgrade.liveness.${state}`].replace('{host}', host);

test.describe('liveness canary after an unreadable pending upgrade', () => {
  test('tells a reachable, probably pending calendar apart from a blocked one, in English and Spanish', async ({ page, context }) => {
    const chain = await installNetwork(context);
    const hits = await routeCanaries(context, { [HOSTS[0]!]: 'readable', [HOSTS[1]!]: 'blocked', [HOSTS[2]!]: 'malformed' });
    await page.goto('/index.html#verify');
    await page.setInputFiles('#upgrade-receipt', { name: 'pending.ots', mimeType: 'application/octet-stream', buffer: pendingReceipt() });
    await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();

    const items = page.locator('.upgrade-liveness li');
    await expect(items).toHaveText([line('en', 'reachable', HOSTS[0]!), line('en', 'unreachable', HOSTS[1]!), line('en', 'unknown', HOSTS[2]!)]);
    await expect(page.locator('.upgrade-liveness')).toContainText(TABLES.en['upgrade.liveness.intro']);
    // The existing pinned notices are unchanged and the receipt is neither changed nor verified.
    await expect(page.locator('.upgrade-result .notice')).toHaveText([PENDING_UPGRADE_NOTICE, UNREADABLE_UPGRADE_NOTICE]);
    await expect(page.locator('.upgrade-result a[download]')).toHaveCount(0);
    await expect(page.locator('.result-VERIFIED')).toHaveCount(0);
    // One canary per calendar for this attempt; the pending lookups stay the three receipt-bound requests.
    expect(hits.sort()).toEqual([...HOSTS].sort());
    const canaries = new Set(LIVENESS_CANARIES.map((c) => c.commitment));
    expect(chain.timestampGets.filter((hex) => !canaries.has(hex))).toHaveLength(3);

    await page.locator('#nav-settings').click();
    await page.getByRole('radio', { name: 'Español', exact: true }).check();
    await page.locator('#nav-verify').click();
    await expect(items).toHaveText([line('es', 'reachable', HOSTS[0]!), line('es', 'unreachable', HOSTS[1]!), line('es', 'unknown', HOSTS[2]!)]);
    await expect(page.locator('.upgrade-liveness')).toContainText(TABLES.es['upgrade.liveness.intro']);
    expect(hits).toHaveLength(3);
  });

  test('reports every calendar as unreachable or blocked when the canaries cannot be read either', async ({ page, context }) => {
    await installNetwork(context);
    const hits = await routeCanaries(context, {});
    await page.goto('/index.html#verify');
    await page.setInputFiles('#upgrade-receipt', { name: 'pending.ots', mimeType: 'application/octet-stream', buffer: pendingReceipt() });
    await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();
    await expect(page.locator('.upgrade-liveness li')).toHaveText(HOSTS.map((h) => line('en', 'unreachable', h)));
    await expect(page.locator('.upgrade-result .notice')).toHaveText([PENDING_UPGRADE_NOTICE, UNREADABLE_UPGRADE_NOTICE]);
    expect(hits.sort()).toEqual([...HOSTS].sort());
  });

  test('sends no canary when the pending replies are readable', async ({ page, context }) => {
    await installNetwork(context, { pendingCors: true });
    const hits = await routeCanaries(context, {});
    await page.goto('/index.html#verify');
    await page.setInputFiles('#upgrade-receipt', { name: 'pending.ots', mimeType: 'application/octet-stream', buffer: pendingReceipt() });
    await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();
    await expect(page.locator('.upgrade-result .notice')).toHaveText([PENDING_UPGRADE_NOTICE]);
    await expect(page.locator('.upgrade-liveness')).toHaveCount(0);
    expect(hits).toEqual([]);
  });
});
