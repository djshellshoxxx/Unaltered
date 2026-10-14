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

const sha256d = (b) => createHash('sha256').update(createHash('sha256').update(b).digest()).digest();

async function req(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Origin: ORIGIN, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000), redirect: 'manual' });
  return { res, body: Buffer.from(await res.arrayBuffer()) };
}
const acao = (res) => res.headers.get('access-control-allow-origin') ?? '(missing)';

for (const host of calendars) {
  try {
    const digest = randomBytes(32);
    const { res, body } = await req(`https://${host}/digest`, { method: 'POST', body: digest, headers: { Accept: 'application/vnd.opentimestamps.v1', 'Content-Type': 'application/x-www-form-urlencoded' } });
    const ok = res.status === 200 && body.length > 0 && body.length < 256 * 1024;
    const cors = ['*', ORIGIN].includes(acao(res));
    const pre = await req(`https://${host}/digest`, { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'accept,content-type' } }).catch(() => null);
    rows.push([host, 'calendar POST /digest', res.status, acao(res), `${body.length} bytes`, pre ? `preflight ${pre.res.status}` : 'preflight failed', ok && cors ? 'PASS' : 'FAIL']);
    if (!(ok && cors)) failed++;
    const g = await req(`https://${host}/timestamp/${digest.toString('hex')}`, { headers: { Accept: 'application/vnd.opentimestamps.v1' } });
    const gcors = ['*', ORIGIN].includes(acao(g.res));
    rows.push([host, 'calendar GET /timestamp/<hex>', g.res.status, acao(g.res), '(expect 404 while pending)', '', g.res.status === 404 && gcors ? 'PASS' : 'FAIL']);
    if (!(g.res.status === 404 && gcors)) failed++;
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
    const okHash = hash === GENESIS_HASH;
    const okHeader = raw.length === 80 && Buffer.from(sha256d(raw)).reverse().toString('hex') === GENESIS_HASH;
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
console.log(`\nChecked ${new Date().toISOString()} from this machine (not a browser). ${failed === 0 ? 'All checks passed.' : failed + ' check(s) failed.'}`);
process.exit(failed === 0 ? 0 : 1);
