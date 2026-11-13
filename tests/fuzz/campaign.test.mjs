// Runs the real fuzz driver in a throwaway Git repository with one synthetic target, so the report can be checked
// without touching this checkout. Fixture bytes are synthetic; nothing here is product input.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const HARNESS = ['scripts/parser-fuzz.mjs', ...readdirSync(join(root, 'scripts/lib')).filter((name) => /^fuzz-.+\.mjs$/.test(name)).sort().map((name) => `scripts/lib/${name}`)];
const TARGETS = `export const TARGETS = ['sample'];
export const crc32 = () => 0;
export const seedCases = (proofs) => [{ target: 'sample', bytes: Uint8Array.of(0) }, ...proofs.map((bytes) => ({ target: 'sample', bytes }))];
export function runCase(_target, bytes) { return bytes[0] === 1 ? 'accepted' : 'rejected'; }
`;

function fixtureRepo(t) {
  const base = mkdtempSync(join(tmpdir(), 'unaltered-fuzz-campaign-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const repo = join(base, 'repo');
  const config = join(base, 'empty.gitconfig');
  writeFileSync(config, '');
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: config,
    GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_COMMON_DIR']) delete env[key];
  const write = (path, contents) => { mkdirSync(dirname(join(repo, path)), { recursive: true }); writeFileSync(join(repo, path), contents); };
  for (const path of HARNESS) { mkdirSync(dirname(join(repo, path)), { recursive: true }); copyFileSync(join(root, path), join(repo, path)); }
  write('tests/fuzz/campaign-targets.ts', TARGETS);
  write('tests/fixtures/ots/sample.ots', 'SYNTHETIC-SEED');
  write('.gitignore', 'node_modules\n');
  symlinkSync(join(root, 'node_modules'), join(repo, 'node_modules'), 'junction');
  const git = (...args) => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8' }).trim();
  git('-c', 'init.defaultBranch=main', 'init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
  const out = join(base, 'out');
  const run = (extraEnv = {}, extraArgs = []) => spawnSync(process.execPath, ['scripts/parser-fuzz.mjs', '--iterations', '30', '--seconds', '60', '--seed', '7', '--out', out, ...extraArgs],
    { cwd: repo, env: { ...env, ...extraEnv }, encoding: 'utf8', timeout: 60000 });
  return { repo, out, git, write, run };
}

test('campaign report counts covered source offsets per target', (t) => {
  const { run } = fixtureRepo(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'budget-complete');
  assert.ok(report.targets.sample.coveredOffsets > 0);
  assert.equal(Object.hasOwn(report.targets.sample, 'ranges'), false);
});

test('campaign never executes a Git replacement from the inherited PATH', (t) => {
  const { repo, git, run } = fixtureRepo(t);
  const tools = join(repo, 'untrusted-tools');
  mkdirSync(tools);
  const fake = join(tools, process.platform === 'win32' ? 'git.exe' : 'git');
  if (process.platform === 'win32') {
    // A real executable that rejects Git arguments, without requiring a compiler or shell lookup.
    copyFileSync(process.execPath, fake);
  } else {
    writeFileSync(fake, '#!/bin/sh\necho UNTRUSTED_GIT_EXECUTED >&2\nexit 99\n');
    chmodSync(fake, 0o755);
  }
  const result = run({ PATH: tools, Path: tools });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).sourceCommit, git('rev-parse', 'HEAD'));
  assert.doesNotMatch(result.stderr, /UNTRUSTED_GIT_EXECUTED/);
});

test('campaign reads Git evidence even with an empty inherited PATH', (t) => {
  const { git, run } = fixtureRepo(t);
  const result = run({ PATH: '', Path: '' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).sourceCommit, git('rev-parse', 'HEAD'));
});

// macOS's temp directory (/var/folders/...) is a symlink to /private/var/...: V8 reports coverage under the module's
// real path, so a driver that filters coverage by the symlinked URL sees none and stops with a false finding.
test('campaign works when the temp directory is reached through a symlink (macOS /var -> /private/var)', { skip: process.platform === 'win32' && 'TMPDIR is POSIX-only' }, (t) => {
  const { run } = fixtureRepo(t);
  const real = mkdtempSync(join(tmpdir(), 'unaltered-fuzz-realtmp-'));
  const link = `${real}-link`;
  symlinkSync(real, link);
  t.after(() => { rmSync(link, { force: true }); rmSync(real, { recursive: true, force: true }); });
  const result = run({ TMPDIR: link });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'budget-complete');
  assert.ok(report.targets.sample.coveredOffsets > 0);
});

test('campaign refuses seed fixtures that Git does not track', (t) => {
  const { repo, out, git, write, run } = fixtureRepo(t);
  write('tests/fixtures/ots/zz-untracked-local.ots', 'SYNTHETIC-UNTRACKED');
  const untracked = run();
  assert.notEqual(untracked.status, 0, 'an untracked seed must stop the campaign');
  assert.match(untracked.stderr, /tests\/fixtures\/ots\/zz-untracked-local\.ots is not tracked by Git/);
  assert.equal(existsSync(out), false, 'nothing is fuzzed or written');

  rmSync(join(repo, 'tests/fixtures/ots/zz-untracked-local.ots'));
  write('.gitignore', 'node_modules\nlocal-*.ots\n');
  git('commit', '-q', '-am', 'ignore local receipts');
  write('tests/fixtures/ots/local-receipt.ots', 'SYNTHETIC-IGNORED');
  const ignored = run();
  assert.notEqual(ignored.status, 0, 'an ignored seed must stop the campaign');
  assert.match(ignored.stderr, /tests\/fixtures\/ots\/local-receipt\.ots is not tracked by Git/);
  assert.equal(existsSync(out), false, 'nothing is fuzzed or written');
});

test('campaign report says when the tree differs from the commit and hashes the harness and seeds', (t) => {
  const { repo, git, write, run } = fixtureRepo(t);
  const clean = run();
  assert.equal(clean.status, 0, clean.stderr);
  const before = JSON.parse(clean.stdout);
  assert.equal(before.sourceCommit, git('rev-parse', 'HEAD'));
  assert.equal(before.sourceDirty, false);
  assert.deepEqual(before.harnessSha256, Object.fromEntries(HARNESS.map((path) => [path, sha256(readFileSync(join(repo, path)))])));
  assert.deepEqual(before.seedFixtures, { count: 1, sha256: sha256(`${sha256('SYNTHETIC-SEED')}  sample.ots\n`) });

  // A local mutator edit shows up even though HEAD is unchanged.
  write('scripts/parser-fuzz.mjs', `${readFileSync(join(repo, 'scripts/parser-fuzz.mjs'), 'utf8')}// local edit\n`);
  const edited = run();
  assert.equal(edited.status, 0, edited.stderr);
  const local = JSON.parse(edited.stdout);
  assert.equal(local.sourceCommit, before.sourceCommit);
  assert.equal(local.sourceDirty, true);
  assert.notEqual(local.harnessSha256['scripts/parser-fuzz.mjs'], before.harnessSha256['scripts/parser-fuzz.mjs']);
  git('checkout', '-q', '--', 'scripts/parser-fuzz.mjs');

  // So do a staged, not yet committed seed and an untracked file anywhere in the tree.
  write('tests/fixtures/ots/extra.ots', 'SYNTHETIC-EXTRA');
  git('add', 'tests/fixtures/ots/extra.ots');
  const staged = JSON.parse(run().stdout);
  assert.equal(staged.sourceDirty, true);
  assert.equal(staged.seedFixtures.count, 2);
  git('commit', '-q', '-m', 'extra seed');
  write('notes.txt', 'local');
  assert.equal(JSON.parse(run().stdout).sourceDirty, true);
});

test('--targets limits the campaign to the named targets and refuses unknown names', (t) => {
  const { git, write, run } = fixtureRepo(t);
  // Two targets, one asynchronous; seeds exist for both, and a repair hook that marks every mutation it sees.
  write('tests/fuzz/campaign-targets.ts', `export const TARGETS = ['sample', 'other'];
export const crc32 = () => 0;
export const seedCases = async (proofs) => [{ target: 'sample', bytes: Uint8Array.of(0) }, { target: 'other', bytes: Uint8Array.of(1) }, ...proofs.map((bytes) => ({ target: 'sample', bytes }))];
export const repairCase = (target, bytes) => (target === 'other' ? Uint8Array.of(1, ...bytes) : bytes);
export async function runCase(target, bytes) { if (target === 'other' && bytes[0] !== 1) throw new Error('repair hook was not applied'); return bytes[0] === 1 ? 'accepted' : 'rejected'; }
`);
  git('commit', '-q', '-am', 'two targets');
  const all = run();
  assert.equal(all.status, 0, all.stderr);
  assert.deepEqual(Object.keys(JSON.parse(all.stdout).targets), ['sample', 'other']);
  const only = run({}, ['--targets', 'other']);
  assert.equal(only.status, 0, only.stderr);
  const report = JSON.parse(only.stdout);
  assert.deepEqual(Object.keys(report.targets), ['other']);
  assert.equal(report.options.targets, 'other');
  assert.equal(report.seedExecutions, 1);
  assert.equal(report.targets.other.accepted + report.targets.other.rejected, 31);
  const unknown = run({}, ['--targets', 'other,missing']);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /Unknown fuzz target\(s\): missing/);
});
