// Offline tests for the local file handling of the opt-in R1 runners (scripts/r1-acceptance.{mjs,sh}). Test doubles
// stand in for Playwright, curl, sha256sum and Python, so no browser, network, calendar or explorer is involved; every
// byte is synthetic and none of it is a real receipt or block header.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
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

// r1-acceptance.sh runs in a scratch copy of the layout it expects (scripts/, tests/differential/) with test doubles for
// everything outside it: the browser step, curl, sha256sum and python3 (venv, pip and the reference oracle). Every
// double appends its argv to R1_CALLS as \x1f-separated fields ending in \x1e.
const HASH = `${'0'.repeat(63)}1`;
const HEADER = 'ab'.repeat(100);
const LOGGER = `#!/bin/sh
{ printf '%s\\037' "$(basename "$0")" "$@"; printf '\\036'; } >> "$R1_CALLS"
`;
const CURL = `${LOGGER}out=; url=
while [ $# -gt 0 ]; do
  case "$1" in -o) out="$2"; shift 2 ;; https://*) url="$1"; shift ;; *) shift ;; esac
done
emit() { if [ -n "$out" ]; then printf '%s' "$1" > "$out"; else printf '%s' "$1"; fi; }
case "$url" in
  https://raw.githubusercontent.com/*/examples/incomplete.txt) emit 'synthetic file' ;;
  https://raw.githubusercontent.com/*/examples/incomplete.txt.ots) emit 'synthetic receipt' ;;
  'https://blockchain.info/block-height/428648?format=json') emit '{"blocks":[{"hash":"${HASH}"}]}' ;;
  'https://blockchain.info/rawblock/${HASH}?format=hex') emit '${HEADER}' ;;
  *) echo 'curl: (22) The requested URL returned error: 404' >&2; exit 22 ;;
esac
`;
const PYTHON = `${LOGGER}if [ "$1" = -m ] && [ "$2" = venv ]; then
  mkdir -p "$3/bin" && cp "$R1_LOGGER" "$3/bin/pip" && cp "$R1_LOGGER" "$3/bin/python"
elif [ "$1" = -c ]; then
  sed -n 's/.*"hash":"\\([0-9a-f]*\\)".*/\\1/p'
else
  exit 2
fi
`;

function shellRun(t) {
  const dir = scratch(t, 'unaltered-r1-shell-test-');
  const root = join(dir, 'root');
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'tests', 'differential'), { recursive: true });
  copyFileSync(join(ROOT, 'scripts/r1-acceptance.sh'), join(root, 'scripts/r1-acceptance.sh'));
  copyFileSync(join(ROOT, 'tests/r1/stubs/browser-step.mjs'), join(root, 'scripts/r1-acceptance.mjs'));
  writeFileSync(join(root, 'tests/differential/verify_reference.py'), '# placeholder: the python test double never runs it\n');
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  for (const [name, body] of [['curl', CURL], ['python3', PYTHON], ['sha256sum', `${LOGGER}cat >/dev/null\n`], ['logger', LOGGER]]) {
    writeFileSync(join(bin, name), body);
    chmodSync(join(bin, name), 0o755);
  }
  const log = join(dir, 'calls.log');
  writeFileSync(log, '');
  const run = (...work) => spawnSync('bash', ['scripts/r1-acceptance.sh', ...work], {
    cwd: root, encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, PATH: `${bin}:${dirname(process.execPath)}:${process.env.PATH}`, TMPDIR: dir, R1_CALLS: log, R1_LOGGER: join(bin, 'logger') },
  });
  const calls = () => readFileSync(log, 'utf8').split('\x1e').filter(Boolean).map((record) => record.split('\x1f').slice(0, -1));
  return { dir, root, run, calls };
}

function assertReferenceRan(r, result, work) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const oracle = r.calls().filter(([name]) => name === 'python');
  assert.equal(oracle.length, 1, JSON.stringify(r.calls()));
  const [, script, file, receipt, header] = oracle[0];
  assert.equal(script, 'tests/differential/verify_reference.py');
  assert.equal(file, join(work, 'incomplete.txt'));
  assert.equal(receipt, join(work, 'out', 'incomplete.txt.ots'));
  assert.equal(readFileSync(receipt, 'utf8'), 'synthetic upgraded receipt\n');
  assert.equal(header, HEADER.slice(0, 160));
}

test('r1-acceptance.sh: a relative work directory reaches the reference step with absolute paths', { skip: !posix && 'POSIX shell' }, (t) => {
  const r = shellRun(t);
  assertReferenceRan(r, r.run('r1-out'), join(r.root, 'r1-out'));
});

test('r1-acceptance.sh: a work directory containing a space reaches the reference step intact', { skip: !posix && 'POSIX shell' }, (t) => {
  const r = shellRun(t);
  const work = join(r.dir, 'with space');
  assertReferenceRan(r, r.run(work), work);
});

test('r1-acceptance.sh: every third-party fetch is bounded in time and size', { skip: !posix && 'POSIX shell' }, (t) => {
  const r = shellRun(t);
  const result = r.run();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const fetches = r.calls().filter(([name]) => name === 'curl');
  assert.equal(fetches.length, 4);
  const value = (args, option) => {
    const at = args.indexOf(option);
    return at < 0 ? NaN : Number(args[at + 1]);
  };
  for (const args of fetches) {
    const url = args.find((arg) => arg.startsWith('https://'));
    const seconds = value(args, '--max-time');
    const bytes = value(args, '--max-filesize');
    assert.ok(seconds > 0 && seconds <= 300, `${url}: --max-time ${seconds}`);
    assert.ok(bytes > 0 && bytes <= 64 * 1024 * 1024, `${url}: --max-filesize ${bytes}`);
    assert.ok(value(args, '--connect-timeout') > 0, `${url}: --connect-timeout`);
  }
});
