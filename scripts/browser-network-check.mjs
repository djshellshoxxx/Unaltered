// Opt-in live browser CORS probe. Run after npm run build; submits one random commitment per calendar.
// Uses the built app's CSP and the browser's normal security policy. No route mocks or CORS bypass.
import { chromium } from '@playwright/test';
import { serveDist } from './lib/serve-dist.mjs';

const hosts = ['alice.btc.calendar.opentimestamps.org', 'bob.btc.calendar.opentimestamps.org', 'finney.calendar.eternitywall.com'];
const explorers = ['mempool.space', 'blockstream.info'];
const genesis = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
const site = await serveDist();
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox'], // Same managed-host process configuration as playwright.config.ts.
  });
  const page = await browser.newPage();
  const failures = [];
  page.on('requestfailed', (request) => failures.push({ host: new URL(request.url()).host, error: request.failure()?.errorText }));
  await page.goto(`${site.origin}/index.html`);
  const results = await page.evaluate(async ({ hosts, explorers, genesis }) => {
    const csp = [];
    document.addEventListener('securitypolicyviolation', (e) => csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    const request = async (url, init = {}) => {
      try {
        const response = await fetch(url, {
          ...init, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error',
          signal: AbortSignal.timeout(15000), headers: { Accept: 'application/vnd.opentimestamps.v1' },
        });
        const reader = response.body?.getReader();
        const chunks = [];
        let size = 0;
        if (reader) for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 256 * 1024) { await reader.cancel(); throw new Error('Reply exceeds probe limit.'); }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        return { status: response.status, length: bytes.length, bytes: Array.from(bytes) };
      } catch (error) { return { error: error.name }; }
    };
    const calendars = await Promise.all(hosts.map(async (host) => {
      const commitment = crypto.getRandomValues(new Uint8Array(32));
      const hex = Array.from(commitment, (b) => b.toString(16).padStart(2, '0')).join('');
      const post = await request(`https://${host}/digest`, { method: 'POST', body: commitment });
      const pending = await request(`https://${host}/timestamp/${hex}`);
      // Omit proof bodies and random commitments from diagnostic output.
      delete post.bytes; delete pending.bytes;
      return { host, post, pending };
    }));
    const sources = await Promise.all(explorers.map(async (host) => {
      const height = await request(`https://${host}/api/block-height/0`);
      const header = await request(`https://${host}/api/block/${genesis}/header`);
      const text = (r) => r.bytes ? new TextDecoder().decode(new Uint8Array(r.bytes)).trim() : '';
      const hashMatches = text(height) === genesis;
      let headerMatches = false;
      if (/^[0-9a-f]{160}$/i.test(text(header))) {
        const raw = Uint8Array.from(text(header).match(/../g), (b) => parseInt(b, 16));
        const first = await crypto.subtle.digest('SHA-256', raw);
        const second = new Uint8Array(await crypto.subtle.digest('SHA-256', first));
        headerMatches = Array.from(second.reverse(), (b) => b.toString(16).padStart(2, '0')).join('') === genesis;
      }
      delete height.bytes; delete header.bytes;
      return { host, height, header, hashMatches, headerMatches };
    }));
    return { calendars, sources, csp };
  }, { hosts, explorers, genesis });
  const ok = results.calendars.every((r) => r.post.status === 200 && r.post.length > 0 && r.post.length < 256 * 1024 && r.pending.status === 404)
    && results.sources.every((r) => r.height.status === 200 && r.header.status === 200 && r.hashMatches && r.headerMatches)
    && results.csp.length === 0;
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), browser: browser.version(), ...results, requestFailures: failures,
    confirmedUpgrade: 'NOT TESTED: requires a known anchored live receipt; this probe alone cannot close R1.', ok }, null, 2));
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser?.close();
  await site.close();
}
