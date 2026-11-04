// Offline test for scripts/network-check.mjs: a fetch test double (tests/toolkit/stubs/fetch-double.mjs) replaces
// the network, so no calendar or explorer is contacted and no digest is submitted anywhere.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DOUBLE = pathToFileURL(join(ROOT, 'tests/toolkit/stubs/fetch-double.mjs')).href;
const CAP = 256 * 1024;

function networkCheck(bodyBytes) {
  const result = spawnSync(process.execPath, [`--import=${DOUBLE}`, join(ROOT, 'scripts/network-check.mjs')], {
    cwd: ROOT, encoding: 'utf8', timeout: 60_000, env: { ...process.env, NETCHECK_BODY_BYTES: String(bodyBytes) },
  });
  const line = result.stderr.split('\n').find((l) => l.startsWith('NETCHECK_STREAMS '));
  assert.ok(line, result.stderr);
  const rows = result.stdout.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Host') && !l.startsWith('|---'));
  return { result, rows, streams: JSON.parse(line.slice('NETCHECK_STREAMS '.length)) };
}

test('an oversized calendar or explorer reply is cut off at the 256 KiB cap and reported as FAIL', () => {
  const { result, rows, streams } = networkCheck(8 * 1024 * 1024);
  assert.equal(result.status, 1, result.stdout);
  assert.equal(Object.keys(streams).length, 5, JSON.stringify(streams));
  for (const [request, { pulled, cancelled }] of Object.entries(streams)) {
    assert.ok(pulled <= CAP + 64 * 1024, `${request}: pulled ${pulled} bytes of an oversized body`);
    assert.ok(cancelled, `${request}: the rest of the body was not cancelled`);
  }
  for (const row of rows.filter((r) => r.includes('POST /digest') || r.includes('explorer'))) assert.match(row, /\| FAIL \|$/);
});

test('control: a normal-sized calendar reply is still read whole and can PASS', () => {
  const { rows, streams } = networkCheck(1024);
  for (const { pulled, cancelled } of Object.values(streams)) assert.ok(pulled === 1024 && !cancelled);
  const posts = rows.filter((r) => r.includes('POST /digest'));
  assert.equal(posts.length, 3);
  for (const row of posts) assert.match(row, /\| 1024 bytes \| preflight 204 \| PASS \|$/);
});
