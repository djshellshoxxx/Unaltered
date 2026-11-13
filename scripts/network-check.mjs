// M0-3 helper: run this from a machine with normal internet access. It checks, for every allowlisted host, the things the
// browser app depends on: reachability, an Access-Control-Allow-Origin header for a foreign Origin (CORS), and the API shape.
// It submits ONE random 32-byte value to each calendar (carries no information) and reads the Genesis block header from explorers.
// Output is a markdown table to paste into docs/NETWORK.md. Exit code 1 if any required check fails.
import { randomBytes, createHash } from 'node:crypto';

const ORIGIN = 'https://app.example.invalid';
const calendars = ['alice.btc.calendar.opentimestamps.org', 'bob.btc.calendar.opentimestamps.org', 'finney.calendar.eternitywall.com'];
const explorers = ['mempool.space', 'blockstream.info'];
const GENESIS_HASH = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
const rows = [];
let failed = 0;
let externalCorsWarnings = 0;

const sha256d = (b) => createHash('sha256').update(createHash('sha256').update(b).digest()).digest();
// The app's response cap (SPEC section 9). A reply this large fails, and is never read further: the timeout bounds
// time, not bytes, so a hostile or intercepting endpoint could otherwise fill this process's memory.
const MAX_BODY = 256 * 1024;

async function req(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Origin: ORIGIN, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000), redirect: 'manual' });
  const chunks = [];
  let size = 0;
  const reader = res.body?.getReader();
  for (;;) {
    const { done, value } = reader ? await reader.read() : { done: true };
    if (done) return { res, body: Buffer.concat(chunks), oversized: false };
    size += value.byteLength;
    if (size >= MAX_BODY) {
      await reader.cancel().catch(() => {});
      return { res, body: Buffer.concat(chunks), oversized: true };
    }
    chunks.push(Buffer.from(value));
  }
}
const acao = (res) => res.headers.get('access-control-allow-origin') ?? '(missing)';

for (const host of calendars) {
  try {
    const digest = randomBytes(32);
    const { res, body, oversized } = await req(`https://${host}/digest`, { method: 'POST', body: digest, headers: { Accept: 'application/vnd.opentimestamps.v1', 'Content-Type': 'application/x-www-form-urlencoded' } });
    const ok = res.status === 200 && body.length > 0 && !oversized;
    const cors = ['*', ORIGIN].includes(acao(res));
    const pre = await req(`https://${host}/digest`, { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'accept,content-type' } }).catch(() => null);
    rows.push([host, 'calendar POST /digest', res.status, acao(res), oversized ? `>= ${MAX_BODY} bytes (cut off)` : `${body.length} bytes`, pre ? `preflight ${pre.res.status}` : 'preflight failed', ok && cors ? 'PASS' : 'FAIL']);
    if (!(ok && cors)) failed++;
    const g = await req(`https://${host}/timestamp/${digest.toString('hex')}`, { headers: { Accept: 'application/vnd.opentimestamps.v1' } });
    const gcors = ['*', ORIGIN].includes(acao(g.res));
    // Upstream calendars control CORS on their 404 responses. A missing header is a real browser
    // interoperability limitation, but cannot be repaired by this static-site repository.
    // Keep it visible without misclassifying a successful POST as a failed protocol submission.
    const pending404WithoutCors = g.res.status === 404 && !gcors && !g.oversized;
    const lookupResult = g.res.status === 404 && gcors ? 'PASS'
      : pending404WithoutCors ? 'UPSTREAM_CORS_WARNING' : 'FAIL';
    rows.push([host, 'calendar GET /timestamp/<hex>', g.res.status, acao(g.res),
      '(expect 404 while pending)', '', lookupResult]);
    if (pending404WithoutCors) externalCorsWarnings++;
    else if (lookupResult === 'FAIL') failed++;
  } catch (e) {
    rows.push([host, 'calendar', 'error', '', String(e.cause?.code ?? e.message), '', 'FAIL']);
    failed++;
  }
}

for (const host of explorers) {
  try {
    const h = await req(`https://${host}/api/block-height/0`);
    const hash = h.body.toString().trim();
    const hdr = await req(`https://${host}/api/block/${GENESIS_HASH}/header`);
    const raw = Buffer.from(hdr.body.toString().trim(), 'hex');
    const okHash = !h.oversized && hash === GENESIS_HASH;
    const okHeader = !hdr.oversized && raw.length === 80 && Buffer.from(sha256d(raw)).reverse().toString('hex') === GENESIS_HASH;
    const cors = ['*', ORIGIN].includes(acao(h.res)) && ['*', ORIGIN].includes(acao(hdr.res));
    rows.push([host, 'explorer /api/block-height + /header', `${h.res.status}/${hdr.res.status}`, `${acao(h.res)}`, okHash && okHeader ? 'genesis header matches' : 'UNEXPECTED BODY', '', okHash && okHeader && cors ? 'PASS' : 'FAIL']);
    if (!(okHash && okHeader && cors)) failed++;
  } catch (e) {
    rows.push([host, 'explorer', 'error', '', String(e.cause?.code ?? e.message), '', 'FAIL']);
    failed++;
  }
}

console.log('| Host | Check | Status | Access-Control-Allow-Origin | Detail | Preflight | Result |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.join(' | ')} |`);
console.log(`\nChecked ${new Date().toISOString()} from this machine (not a browser). ${failed} required check(s) failed; ${externalCorsWarnings} upstream pending-404 CORS warning(s).`);
process.exit(failed === 0 ? 0 : 1);
