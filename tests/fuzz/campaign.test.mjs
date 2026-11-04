// Runs the real fuzz driver in a throwaway Git repository with one synthetic target, so the report can be checked
// without touching this checkout. Fixture bytes are synthetic; nothing here is product input.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
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
  write('tests/fuzz/targets.ts', TARGETS);
  write('tests/fixtures/ots/sample.ots', 'SYNTHETIC-SEED');
  write('.gitignore', 'node_modules\n');
  symlinkSync(join(root, 'node_modules'), join(repo, 'node_modules'), 'junction');
  const git = (...args) => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8' }).trim();
  git('-c', 'init.defaultBranch=main', 'init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
  const run = () => spawnSync(process.execPath, ['scripts/parser-fuzz.mjs', '--iterations', '30', '--seconds', '60', '--seed', '7', '--out', join(base, 'out')],
    { cwd: repo, env, encoding: 'utf8', timeout: 60000 });
  return { repo, git, write, run };
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
