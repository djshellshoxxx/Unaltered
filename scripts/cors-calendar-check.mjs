// Opt-in research harness, not the application: no allowlist/CSP changes, no proxy and no security-policy bypass.
// node scripts/cors-calendar-check.mjs [--include-reference-pools]
// Sends one random commitment per selected, source-documented endpoint; prints no commitments or proof bodies.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

/** Runs inside a normal page; also used against deterministic local CORS fixtures. */
export async function browserRequest({ url, bytes, accept = 'application/vnd.opentimestamps.v1', timeoutMs = 15_000, cap = 256 * 1024 }) {
  try {
    const response = await fetch(url, {
      method: bytes ? 'POST' : 'GET', ...(bytes ? { body: new Uint8Array(bytes) } : {}),
      headers: { Accept: accept }, mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store',
      referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(timeoutMs),
    });
    const reader = response.body?.getReader();
    const chunks = [];
    let size = 0;
    if (reader) for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > cap) { await reader.cancel(); throw new Error('Reply exceeds probe limit.'); }
      chunks.push(part.value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return { status: response.status, bytes: Array.from(result) };
  } catch (error) {
    return { error: error.name === 'Error' ? 'REPLY_LIMIT_OR_READ_ERROR' : error.name };
  }
}

export async function loadProtocol() {
  // Bundle only trusted local source for the Node-side protocol parser; no third-party source is copied.
  const output = await build({ entryPoints: ['scripts/cors-calendar-protocol.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
}

// Shared with the emitted-app-CSP probe. A receipt cannot expand that caller's calendar policy.
export async function probePendingCalendar(page, endpoint, allowedOrigins) {
  const protocol = await loadProtocol();
  if (!allowedOrigins.includes(endpoint) || !protocol.RESEARCH_CALENDARS.includes(endpoint)) throw new Error('Unapproved probe endpoint.');
  const submitted = randomBytes(32);
  const reply = await page.evaluate(browserRequest, { url: `${endpoint}/digest`, bytes: Array.from(submitted) });
  const result = { host: new URL(endpoint).host,
    post: { status: reply.status ?? null, length: reply.bytes?.length ?? null, error: reply.error ?? null }, pendingLookups: [] };
  if (reply.status !== 200 || !reply.bytes) return result;
  let targets;
  try {
    targets = protocol.pendingRequests(new Uint8Array(reply.bytes), submitted);
    if (targets.some((target) => !allowedOrigins.includes(target.origin))) throw new Error('Calendar outside caller policy.');
  } catch { result.protocolError = 'INVALID_OR_UNAPPROVED_SUBMISSION_PROOF'; return result; }
  for (const target of targets) {
    const answer = await page.evaluate(browserRequest, { url: `${target.origin}/timestamp/${target.commitmentHex}` });
    result.pendingLookups.push({ host: new URL(target.origin).host, status: answer.status ?? null,
      length: answer.bytes?.length ?? null, error: answer.error ?? null,
      classification: answer.status ? protocol.classifyReply(answer.status, new Uint8Array(answer.bytes ?? []), Buffer.from(target.commitmentHex, 'hex')) : 'UNREADABLE_CORS_OR_TRANSPORT' });
  }
  result.pending = result.pendingLookups[0] ?? null;
  return result;
}

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--include-reference-pools')) throw new Error('Only --include-reference-pools is supported.');
  const protocol = await loadProtocol();
  const origins = protocol.RESEARCH_CALENDARS;
  const selected = process.argv.includes('--include-reference-pools') ? origins : origins.slice(0, 3);
  // This separate, explicitly labelled research page permits only the documented candidate origins.
  const server = createServer((_req, res) => res.writeHead(200, { 'content-type': 'text/html',
    'content-security-policy': `default-src 'none'; connect-src ${origins.join(' ')}` }).end('<!doctype html><title>Calendar CORS research</title>'));
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  let browser;
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(origin);
    const results = [];
    for (const endpoint of selected) {
      const submitted = randomBytes(32);
      const reply = await page.evaluate(browserRequest, { url: `${endpoint}/digest`, bytes: Array.from(submitted) });
      const record = { endpoint, post: { status: reply.status ?? null, error: reply.error ?? null, length: reply.bytes?.length ?? null }, lookups: [] };
      results.push(record);
      if (reply.status !== 200 || !reply.bytes) continue;
      let targets;
      try { targets = protocol.pendingRequests(new Uint8Array(reply.bytes), submitted); }
      catch { record.protocolError = 'INVALID_OR_UNAPPROVED_SUBMISSION_PROOF'; continue; }
      for (const target of targets) {
        // Crucial: query the commitment attached to the receipt's pending attestation, not the submitted root.
        const variants = ['application/vnd.opentimestamps.v1', '*/*'].map((accept) => ({ calendar: target.origin, accept, identity: 'RECEIPT_URI' }));
        if (endpoint !== target.origin) variants.push({ calendar: endpoint, accept: 'application/vnd.opentimestamps.v1', identity: 'POOL_OVERRIDE_RESEARCH_ONLY' });
        for (const { calendar, accept, identity } of variants) {
          const url = `${calendar}/timestamp/${target.commitmentHex}`;
          const answer = await page.evaluate(browserRequest, { url, accept });
          const lookup = { calendar, receiptCalendar: target.origin, identity, accept, browserStatus: answer.status ?? null, browserError: answer.error ?? null,
            classification: answer.status ? protocol.classifyReply(answer.status, new Uint8Array(answer.bytes ?? []), Buffer.from(target.commitmentHex, 'hex')) : 'UNREADABLE_CORS_OR_TRANSPORT' };
          // Header-only corroboration is explicitly separate and cannot turn a browser failure into a pass.
          try {
            const header = await fetch(url, { headers: { Accept: accept, Origin: origin }, redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(15_000) });
            lookup.headerOnly = { status: header.status, acao: header.headers.get('access-control-allow-origin') };
            await header.body?.cancel();
          } catch { lookup.headerOnly = { error: 'TRANSPORT_OR_REDIRECT' }; }
          record.lookups.push(lookup);
        }
      }
    }
    const ok = results.every((r) => r.post.status === 200 && !r.protocolError && r.lookups.length > 0
      && r.lookups.every((l) => l.classification === 'READABLE_404' || l.classification === 'READABLE_PENDING_TREE'));
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), browser: browser.version(),
      scope: 'Research harness; candidate CSP is not the application CSP. Pool overrides are research-only identity changes. No confirmations, independent Bitcoin verification or new app endpoint eligibility are established.',
      pendingLookupIdentity: 'Replayed POST proof, then used each pending attestation node commitment.', results, ok }, null, 2));
    process.exitCode = ok ? 0 : 1;
  } finally {
    await browser?.close();
    await new Promise((done) => server.close(done));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
