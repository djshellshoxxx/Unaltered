// Opt-in emitted-app-CSP CORS probe. Run after build; submits random protocol commitments, never user files.
// Follow the parsed POST receipt's pending node commitment and only the existing app calendar hosts.
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { serveDist } from './lib/serve-dist.mjs';
import { browserRequest, probePendingCalendar } from './cors-calendar-check.mjs';

const hosts = ['alice.btc.calendar.opentimestamps.org', 'bob.btc.calendar.opentimestamps.org', 'finney.calendar.eternitywall.com'];
const allowedOrigins = hosts.map((host) => `https://${host}`);
const explorers = ['mempool.space', 'blockstream.info'];
const genesis = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
const site = await serveDist();
let browser;
try {
  browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const failures = [];
  page.on('requestfailed', (request) => failures.push({ host: new URL(request.url()).host, error: request.failure()?.errorText }));
  await page.addInitScript(() => {
    window.__corsProbeCsp = [];
    document.addEventListener('securitypolicyviolation', (event) => window.__corsProbeCsp.push(`${event.violatedDirective} ${event.blockedURI}`));
  });
  await page.goto(`${site.origin}/index.html`);
  const calendars = await Promise.all(allowedOrigins.map((endpoint) => probePendingCalendar(page, endpoint, allowedOrigins)));
  const sources = await Promise.all(explorers.map(async (host) => {
    const height = await page.evaluate(browserRequest, { url: `https://${host}/api/block-height/0` });
    const header = await page.evaluate(browserRequest, { url: `https://${host}/api/block/${genesis}/header` });
    const text = (reply) => reply.bytes ? Buffer.from(reply.bytes).toString('utf8').trim() : '';
    const hashMatches = text(height) === genesis;
    const headerText = text(header);
    const headerMatches = /^[0-9a-f]{160}$/i.test(headerText)
      && createHash('sha256').update(createHash('sha256').update(Buffer.from(headerText, 'hex')).digest()).digest().reverse().toString('hex') === genesis;
    const summary = (reply) => ({ status: reply.status ?? null, length: reply.bytes?.length ?? null, error: reply.error ?? null });
    return { host, height: summary(height), header: summary(header), hashMatches, headerMatches };
  }));
  const csp = await page.evaluate(() => window.__corsProbeCsp);
  const ok = calendars.every((result) => result.post.status === 200 && !result.protocolError && result.pendingLookups.length > 0
      && result.pendingLookups.every((lookup) => lookup.classification === 'READABLE_404' || lookup.classification === 'READABLE_PENDING_TREE'))
    && sources.every((result) => result.height.status === 200 && result.header.status === 200 && result.hashMatches && result.headerMatches)
    && csp.length === 0;
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), browser: browser.version(), calendars, sources, csp,
    requestFailures: failures, pendingLookupIdentity: 'Validated POST proof; looked up each pending attestation node commitment.',
    confirmedUpgrade: 'NOT TESTED: a known anchored receipt and independent reference verification remain separate requirements.', ok }, null, 2));
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser?.close();
  await site.close();
}
