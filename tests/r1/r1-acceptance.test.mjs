// Offline tests for the local file handling of the opt-in R1 runners (scripts/r1-acceptance.{mjs,sh}). Test doubles
// stand in for Playwright, curl, sha256sum and Python, so no browser, network, calendar or explorer is involved; every
// byte is synthetic and none of it is a real receipt or block header.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const RUNNER = join(ROOT, 'scripts/r1-acceptance.mjs');
const REGISTER = pathToFileURL(join(ROOT, 'tests/r1/stubs/register.mjs')).href;
const posix = process.platform !== 'win32';

function scratch(t, prefix) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function browserRun(t) {
  const dir = scratch(t, 'unaltered-r1-runner-test-');
  const tmp = join(dir, 'tmp');
  mkdirSync(tmp, { mode: 0o700 });
  const bytes = Buffer.from('synthetic upgraded-receipt bytes; not an OpenTimestamps receipt\n');
  writeFileSync(join(dir, 'download.bin'), bytes);
  writeFileSync(join(dir, 'file.txt'), 'synthetic file\n');
  writeFileSync(join(dir, 'receipt.ots'), 'synthetic pending receipt\n');
  const log = join(dir, 'verify.log');
  const run = (...out) => spawnSync(process.execPath, [`--import=${REGISTER}`, RUNNER, join(dir, 'file.txt'), join(dir, 'receipt.ots'), ...out], {
    cwd: ROOT, encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, TMPDIR: tmp, R1_STUB_DOWNLOAD: join(dir, 'download.bin'), R1_STUB_LOG: log },
  });
  const verified = () => readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  return { dir, tmp, bytes, run, verified };
}

function assertPrivateReceipt(r, result) {
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.classification, 'PASS');
  const path = report.verify.upgradedReceiptPath;
  const info = lstatSync(path);
  assert.ok(info.isFile() && !info.isSymbolicLink(), 'the receipt is a regular file');
  assert.equal(info.mode & 0o777, 0o600);
  assert.deepEqual(readFileSync(path), r.bytes);
  const last = r.verified().at(-1);
  assert.equal(last.path, path, 'Verify reads the file that was written');
  assert.equal(last.hex, r.bytes.toString('hex'));
  return path;
}

test('r1-acceptance.mjs: the default output is a fresh private directory, not a fixed shared /tmp path', { skip: !posix && 'POSIX modes' }, (t) => {
  const r = browserRun(t);
  const first = assertPrivateReceipt(r, r.run());
  assert.equal(dirname(dirname(first)), r.tmp, 'created under the temp directory');
  assert.match(basename(dirname(first)), /^unaltered-r1-./);
  assert.equal(statSync(dirname(first)).mode & 0o777, 0o700);
  const second = assertPrivateReceipt(r, r.run());
  assert.notEqual(dirname(second), dirname(first), 'each run gets its own directory');
});

test('r1-acceptance.mjs: a symlink planted at the receipt path is replaced, never written through', { skip: !posix && 'POSIX symlinks' }, (t) => {
  const r = browserRun(t);
  const out = join(r.dir, 'out');
  mkdirSync(out);
  const victim = join(r.dir, 'victim.txt');
  writeFileSync(victim, 'must not be overwritten\n');
  symlinkSync(victim, join(out, 'incomplete.txt.ots'));
  const path = assertPrivateReceipt(r, r.run(out));
  assert.equal(path, join(out, 'incomplete.txt.ots'));
  assert.equal(readFileSync(victim, 'utf8'), 'must not be overwritten\n');
});

test('r1-acceptance.mjs: an explicit output directory is created private and can be reused', { skip: !posix && 'POSIX modes' }, (t) => {
  const r = browserRun(t);
  const out = join(r.dir, 'new', 'out');
  assertPrivateReceipt(r, r.run(out));
  assert.equal(statSync(out).mode & 0o777, 0o700);
  assertPrivateReceipt(r, r.run(out));
});
