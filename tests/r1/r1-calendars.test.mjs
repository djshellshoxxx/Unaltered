import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { calendarsInReceipt, classifyCalendars, overall } from '../../scripts/lib/r1-calendars.mjs';

const fixture = (name) => readFileSync(new URL(`../fixtures/ots/${name}`, import.meta.url));
const up = (host, extra) => ({ host, method: 'GET', kind: 'upgrade', ...extra });
const BOB = 'bob.btc.calendar.opentimestamps.org';
const FINNEY = 'finney.calendar.eternitywall.com';

test('finds the Bob and Finney attestations real receipts name, and nothing else', () => {
  assert.deepEqual(calendarsInReceipt(fixture('confirmed.ots')), ['bob']);
  assert.deepEqual(calendarsInReceipt(fixture('batch0.ots')), ['finney']);
  assert.deepEqual(calendarsInReceipt(fixture('pending.ots')), []); // Alice only
  assert.deepEqual(calendarsInReceipt(Buffer.from(`x https://evil.example/${BOB} y`)), []);
});

test('classifies each named calendar from what the browser saw', () => {
  const rows = classifyCalendars({ requests: [
    up(BOB, { status: 200, acao: '*' }),
    up(FINNEY, { status: 404, acao: null }),
    { host: 'mempool.space', method: 'GET', kind: 'explorer', status: 200, acao: '*' },
  ] }, ['bob', 'finney']);
  assert.deepEqual(rows.map((r) => r.result), ['CONFIRMED_READABLE', 'PENDING_BLOCKED']);
  const odd = classifyCalendars({ requests: [
    up(BOB, { failure: 'net::ERR_FAILED' }),
    up(FINNEY, { failure: 'net::ERR_TUNNEL_CONNECTION_FAILED' }),
  ] }, ['bob', 'finney']);
  assert.deepEqual(odd.map((r) => r.result), ['BLOCKED_OR_TRANSPORT', 'TLS_OR_PROXY']);
  assert.equal(classifyCalendars({ requests: [] }, ['bob'])[0].result, 'NOT_REQUESTED');
  assert.equal(classifyCalendars({ requests: [up(BOB, { status: 200, acao: null })] }, ['bob'])[0].result, 'CONFIRMED_BLOCKED');
  assert.equal(classifyCalendars({ requests: [up(BOB, { status: 404, acao: '*' })] }, ['bob'])[0].result, 'PENDING_READABLE');
});

test('passes only when the app run passed and every named calendar gave a readable 200', () => {
  const good = classifyCalendars({ requests: [up(BOB, { status: 200, acao: '*' })] }, ['bob']);
  assert.equal(overall({ classification: 'PASS' }, good), 'PASS');
  assert.equal(overall({ classification: 'NOT_YET_CONFIRMED' }, good), 'NOT_ESTABLISHED');
  assert.equal(overall({ classification: 'PASS' }, []), 'NOT_ESTABLISHED');
  const mixed = classifyCalendars({ requests: [up(BOB, { status: 200, acao: '*' })] }, ['bob', 'finney']);
  assert.equal(overall({ classification: 'PASS' }, mixed), 'NOT_ESTABLISHED');
});

test('the CLI refuses a receipt naming neither calendar and classifies a saved run offline', () => {
  const dir = mkdtempSync(join(tmpdir(), 'r1bf-'));
  const script = new URL('../../scripts/r1-bob-finney.mjs', import.meta.url).pathname;
  const alice = new URL('../fixtures/ots/pending.ots', import.meta.url).pathname;
  const refused = spawnSync(process.execPath, [script, '--from-json', join(dir, 'unused.json'), alice], { encoding: 'utf8' });
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /names neither Bob nor Finney/);

  const saved = join(dir, 'saved.json');
  writeFileSync(saved, JSON.stringify({ classification: 'PASS', verify: { state: 'VERIFIED' }, requests: [up(BOB, { status: 200, acao: '*' })] }));
  const bob = new URL('../fixtures/ots/confirmed.ots', import.meta.url).pathname;
  const ran = spawnSync(process.execPath, [script, '--from-json', saved, bob], { encoding: 'utf8' });
  assert.equal(ran.status, 0, ran.stderr);
  const report = JSON.parse(ran.stdout.slice(0, ran.stdout.indexOf('\n| Calendar')));
  assert.equal(report.mode, 'from-json');
  assert.equal(report.result, 'PASS');
  assert.match(ran.stdout, /\| bob \| bob\.btc\.calendar\.opentimestamps\.org \| 1 \| 200 \| \* \| — \| CONFIRMED_READABLE \|/);
});
