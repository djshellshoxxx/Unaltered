// Offline regressions for scripts/opsec-check.sh. Every repository here is a throwaway scratch repository with a
// synthetic identity and synthetic leaks; the developer's own git configuration is never read (HOME, XDG_CONFIG_HOME
// and GIT_CONFIG_NOSYSTEM are isolated and inherited GIT_* / EMAIL variables are dropped).
// Leak values are assembled at run time on reserved .test domains, so this file never matches what it tests for.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(ROOT, 'scripts/opsec-check.sh');
const skip = process.platform === 'win32' ? 'POSIX shell tooling (bash, git, file)' : false;

const mail = (user) => [user, 'mail.test'].join('@');
const home = (...parts) => ['', 'home', ...parts].join('/');
const NOREPLY = ['handle', 'users.noreply.github.com'].join('@');
const JANE = mail('jane.real');
const LEAK = `contact ${JANE} at ${home('janedoe', 'x')}\n`;
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A [FAIL] line containing every text in order. */
const finding = (...texts) => new RegExp(texts.map(escape).join('.*'));

function sandbox(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'unaltered-opsec-test-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const homeDir = join(dir, 'home');
  mkdirSync(homeDir);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(GIT_|EMAIL$)/.test(key)));
  Object.assign(env, { HOME: homeDir, XDG_CONFIG_HOME: homeDir, GIT_CONFIG_NOSYSTEM: '1', GIT_CEILING_DIRECTORIES: dir, TZ: 'UTC' });
  const run = (cwd, extra = {}) => spawnSync('bash', [SCRIPT], { cwd, env: { ...env, ...extra }, encoding: 'utf8', timeout: 60_000 });
  return { dir, env, run };
}

function repo(t, { email = NOREPLY } = {}) {
  const box = sandbox(t);
  const work = join(box.dir, 'repo');
  mkdirSync(work);
  const git = (args, extra = {}) => {
    const result = spawnSync('git', args, { cwd: work, env: { ...box.env, ...extra }, encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout;
  };
  git(['init', '-q']);
  git(['config', 'user.name', 'handle']);
  if (email) git(['config', 'user.email', email]);
  git(['config', 'commit.gpgsign', 'false']);
  git(['config', 'tag.gpgsign', 'false']);
  const write = (path, content) => {
    mkdirSync(dirname(join(work, path)), { recursive: true });
    writeFileSync(join(work, path), content);
  };
  const commit = (message = ['add'], extra = {}) => {
    git(['add', '-A'], extra);
    git(['commit', '-q', '--allow-empty', ...message.flatMap((m) => ['-m', m])], extra);
  };
  return { ...box, work, git, write, commit, check: (extra) => box.run(work, extra) };
}

const output = (result) => `${result.stdout}\n${result.stderr}`;
function assertPass(result) {
  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /opsec-check: PASS/);
}
function assertFindings(result, ...patterns) {
  assert.equal(result.status, 1, output(result));
  assert.doesNotMatch(result.stdout, /opsec-check: PASS/);
  const failures = result.stdout.split('\n').filter((line) => line.includes('[FAIL]'));
  for (const pattern of patterns) assert.ok(failures.some((line) => pattern.test(line)), `no [FAIL] line matches ${pattern}\n${output(result)}`);
}
function assertNotChecked(result) {
  assert.equal(result.status, 2, output(result));
  assert.doesNotMatch(result.stdout, /PASS/);
}

test('control: a clean repository passes and a tracked leak is found', { skip }, (t) => {
  const r = repo(t);
  r.write('clean.txt', 'nothing personal here\n');
  r.commit();
  assertPass(r.check());
  r.write('leak.txt', LEAK);
  r.commit();
  assertFindings(r.check(), finding('leak.txt contains email: ', JANE), finding('leak.txt contains a home-directory path'));
});

test('a directory that is not a git repository is never reported as PASS', { skip }, (t) => {
  const box = sandbox(t);
  const exported = join(box.dir, 'exported-tree');
  mkdirSync(exported);
  writeFileSync(join(exported, 'leak.txt'), LEAK);
  assertNotChecked(box.run(exported));
});

test('a broken worktree (.git points nowhere) is never reported as PASS', { skip }, (t) => {
  const box = sandbox(t);
  const broken = join(box.dir, 'broken-worktree');
  mkdirSync(broken);
  writeFileSync(join(broken, '.git'), `gitdir: ${join(box.dir, 'missing', 'worktrees', 'x')}\n`);
  writeFileSync(join(broken, 'leak.txt'), LEAK);
  assertNotChecked(box.run(broken));
});

test('a repository git refuses for dubious ownership is never reported as PASS', {
  skip: skip || (process.getuid?.() !== 0 && 'needs root to hand the repository to another owner'),
}, (t) => {
  const r = repo(t);
  r.write('leak.txt', LEAK);
  r.commit();
  assertFindings(r.check(), finding('leak.txt'));
  const chown = spawnSync('chown', ['-R', '65534', r.work]);
  assert.equal(chown.status, 0, String(chown.stderr));
  assertNotChecked(r.check());
});

test('a git read that fails after start-up (missing commit object) is never reported as PASS', { skip }, (t) => {
  const r = repo(t);
  r.write('clean.txt', 'nothing personal here\n');
  r.commit();
  const head = r.git(['rev-parse', 'HEAD']).trim();
  rmSync(join(r.work, '.git', 'objects', head.slice(0, 2), head.slice(2)));
  assertNotChecked(r.check());
});

test('check 1 reads the effective author and committer identity, not only user.email', { skip }, async (t) => {
  for (const [name, configure, extra, pattern] of [
    ['author.email config', (r) => r.git(['config', 'author.email', JANE]), {}, finding('author email ', JANE)],
    ['committer.email config', (r) => r.git(['config', 'committer.email', mail('jane.commit')]), {}, finding('committer email ', mail('jane.commit'))],
    ['GIT_AUTHOR_EMAIL', () => {}, { GIT_AUTHOR_EMAIL: mail('jane.env') }, finding('author email ', mail('jane.env'))],
    ['GIT_COMMITTER_EMAIL', () => {}, { GIT_COMMITTER_EMAIL: mail('jane.env') }, finding('committer email ', mail('jane.env'))],
  ]) {
    await t.test(name, (t) => {
      const r = repo(t);
      configure(r);
      assertFindings(r.check(extra), pattern);
    });
  }
  await t.test('EMAIL fallback when user.email is unset', (t) => {
    const r = repo(t, { email: null });
    assertFindings(r.check({ EMAIL: JANE }), finding('author email ', JANE), finding('committer email ', JANE));
  });
});

test('check 1 passes a no-reply identity and only warns when git has no identity to commit with', { skip }, (t) => {
  const r = repo(t);
  const clean = r.check();
  assertPass(clean);
  assert.match(clean.stdout, /\[ ok \] author email is a no-reply address/);
  assert.match(clean.stdout, /\[ ok \] committer email is a no-reply address/);
  const none = repo(t, { email: null });
  none.git(['config', 'user.useConfigOnly', 'true']);
  const refused = none.check();
  assertPass(refused);
  assert.match(refused.stdout, /\[warn\] git has no author identity/);
});

test('check 2 reads annotated-tag taggers and commit/tag message bodies', { skip }, async (t) => {
  await t.test('annotated tag tagger', (t) => {
    const r = repo(t);
    r.write('a.txt', 'nothing personal here\n');
    r.commit();
    r.git(['tag', '-a', 'v0', '-m', 'v0'], { GIT_COMMITTER_EMAIL: JANE });
    assert.ok(r.git(['for-each-ref', '--format=%(taggeremail)', 'refs/tags']).includes(JANE));
    assertFindings(r.check(), finding('tagger', JANE));
  });
  await t.test('Co-authored-by trailer in a commit message', (t) => {
    const r = repo(t);
    r.write('a.txt', 'nothing personal here\n');
    r.commit(['add', `Co-authored-by: Jane Real <${mail('jane.co')}>`]);
    assertFindings(r.check(), finding('message', mail('jane.co')));
  });
  await t.test('annotated tag message', (t) => {
    const r = repo(t);
    r.write('a.txt', 'nothing personal here\n');
    r.commit();
    r.git(['tag', '-a', 'v1', '-m', `Release signed off by ${JANE}`]);
    assertFindings(r.check(), finding('message', JANE));
  });
});

test('no-reply and GitHub App bot trailers in messages are not findings', { skip }, (t) => {
  const r = repo(t);
  r.write('a.txt', 'nothing personal here\n');
  const bot = ['support', 'bot-service.test'].join('@');
  const agent = ['noreply', 'example.org'].join('@');
  r.commit(['Bump x', `Signed-off-by: dependabot[bot] <${bot}>\nCo-Authored-By: Example Agent <${agent}>`]);
  r.git(['tag', '-a', 'v0', '-m', 'v0']);
  assertPass(r.check());
});
