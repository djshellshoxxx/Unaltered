// Opt-in R1 acceptance: a confirmed upgrade and verification through the built app's real UI in Chromium.
// Usage (after `npm run build`): node scripts/r1-acceptance.mjs <file> <receipt.ots> [output-dir]
// Sends only the app's own requests for the receipt's existing pending commitments: no new calendar submission,
// no route mocks, no CORS bypass, the app's strict CSP. Prints statuses and hosts only, never file names or digests.
// The procedure, including the independent reference check, is in docs/R1_ACCEPTANCE.md.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { serveDist } from './lib/serve-dist.mjs';

const [file, receipt, outDir = '/tmp/unaltered-r1'] = process.argv.slice(2);
if (!file || !receipt) {
  console.error('usage: node scripts/r1-acceptance.mjs <file> <receipt.ots> [output-dir]');
  process.exit(1);
}

const site = await serveDist();
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox'], // Same managed-host process configuration as playwright.config.ts.
  });
  const context = await browser.newContext({ locale: 'en-US', acceptDownloads: true });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });

  // Every non-local request: what the browser saw, so a transport/CORS failure is never mistaken for a proof failure.
  const network = new Map();
  const entry = (request) => {
    if (!network.has(request)) {
      const url = new URL(request.url());
      const kind = url.pathname.startsWith('/timestamp/') ? 'upgrade' : url.pathname.startsWith('/api/') ? 'explorer' : 'other';
      network.set(request, { host: url.host, method: request.method(), kind });
    }
    return network.get(request);
  };
  const external = (request) => !request.url().startsWith(site.origin) && /^https?:/.test(request.url());
  page.on('response', async (response) => {
    if (!external(response.request())) return;
    const n = entry(response.request());
    n.status = response.status();
    n.acao = (await response.allHeaders())['access-control-allow-origin'] ?? null;
  });
  page.on('requestfailed', (request) => {
    if (external(request)) entry(request).failure = request.failure()?.errorText ?? 'unknown';
  });

  await page.goto(`${site.origin}/index.html#verify`);

  // 1. Upgrade through the app.
  await page.setInputFiles('#upgrade-receipt', resolve(receipt));
  await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();
  const upOut = page.locator('.upgrade-result');
  await upOut.locator('.notice, [role=alert]').first().waitFor({ timeout: 60_000 });
  const upgrade = {
    confirmed: await upOut.locator('.notice.ok').count() > 0,
    stillPending: await upOut.locator('.notice.pending').count() > 0,
    receiptError: (await upOut.locator('[role=alert]').allTextContents())[0] ?? null,
    failedCalendars: await upOut.locator('ul.calendars li').allTextContents(),
    unknownCalendars: (await upOut.locator('.warn').allTextContents())[0] ?? null,
    downloaded: false,
  };
  let verifyReceipt = resolve(receipt);
  if (await upOut.locator('a[download]').count() > 0) {
    const [download] = await Promise.all([page.waitForEvent('download'), upOut.locator('a[download]').click()]);
    await mkdir(outDir, { recursive: true });
    verifyReceipt = join(outDir, basename(download.suggestedFilename()));
    await writeFile(verifyReceipt, await readFile(await download.path()));
    upgrade.downloaded = true;
  }

  // 2. Verify the file against the (upgraded) receipt through the app.
  await page.setInputFiles('#verify-file', resolve(file));
  await page.setInputFiles('#verify-receipt', verifyReceipt);
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  const result = page.locator('.verify-result .result');
  await result.waitFor({ timeout: 120_000 });
  const state = /result-([A-Z_]+)/.exec(await result.getAttribute('class'))?.[1] ?? 'UNKNOWN';
  const details = await page.locator('.verify-result dl.details').innerText().catch(() => '');
  const block = /\n(\d+)\n/.exec(details)?.[1] ?? null;
  const csp = await page.evaluate(() => window.__csp);

  const requests = [...network.values()];
  const upgradeRequests = requests.filter((n) => n.kind === 'upgrade');
  // TLS/proxy failures happen before any HTTP reply, so they are about this host's network path, not CORS.
  const tls = requests.filter((n) => /ERR_(CERT|SSL|TUNNEL|PROXY)/.test(n.failure ?? ''));
  const blocked = upgradeRequests.filter((n) => n.failure || (n.status && !n.acao));
  // Order matters: a browser-blocked read says nothing about the receipt, and a pending answer is not a failure.
  const classification = csp.length > 0 ? 'CSP_VIOLATION'
    : state === 'VERIFIED' && (upgrade.confirmed || upgrade.downloaded || upgradeRequests.length === 0) ? 'PASS'
    : tls.length > 0 ? 'TLS_OR_PROXY'
    : blocked.length > 0 ? 'CORS_OR_TRANSPORT'
    : upgrade.receiptError || state === 'INVALID_PROOF' || state === 'NO_MATCH_FILE' ? 'RECEIPT_OR_PROOF'
    : upgrade.stillPending || state === 'PENDING' ? 'NOT_YET_CONFIRMED'
    : state === 'UNREACHABLE' || state === 'SOURCES_DISAGREE' ? 'EXPLORERS'
    : 'UNCLASSIFIED';
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(), browser: `chromium ${browser.version()}`, classification,
    upgrade, verify: { state, block, upgradedReceiptPath: upgrade.downloaded ? verifyReceipt : null }, csp, requests,
    note: 'Browser evidence only. R1 also requires the independent reference check in docs/R1_ACCEPTANCE.md.',
  }, null, 2));
  process.exitCode = classification === 'PASS' ? 0 : 1;
} finally {
  await browser?.close();
  await site.close();
}
