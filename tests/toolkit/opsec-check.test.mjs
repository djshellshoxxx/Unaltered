// Offline regressions for scripts/opsec-check.sh. Every repository here is a throwaway scratch repository with a
// synthetic identity and synthetic leaks; the developer's own git configuration is never read (HOME, XDG_CONFIG_HOME
// and GIT_CONFIG_NOSYSTEM are isolated and inherited GIT_* / EMAIL variables are dropped).
// Leak values are assembled at run time on reserved .test domains, so this file never matches what it tests for.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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

test('checks 3 and 4 read the committed and staged content that is pushed, not only the working tree', { skip }, async (t) => {
  const leaky = (r) => {
    r.write('b.txt', `contact ${JANE}\n`);
    r.write('c.txt', `see ${home('alice', 'x')}\n`);
    r.commit();
  };
  await t.test('committed leak, clean but unstaged working tree', (t) => {
    const r = repo(t);
    leaky(r);
    r.write('b.txt', 'clean\n');
    r.write('c.txt', 'clean\n');
    assertFindings(r.check(), finding('b.txt contains email: ', JANE), finding('c.txt contains a home-directory path'));
  });
  await t.test('committed leak, clean version staged', (t) => {
    const r = repo(t);
    leaky(r);
    r.write('b.txt', 'clean\n');
    r.write('c.txt', 'clean\n');
    r.git(['add', '-A']);
    assertFindings(r.check(), finding('b.txt (committed in HEAD) contains email'), finding('c.txt (committed in HEAD) contains a home-directory path'));
  });
  await t.test('committed leak deleted from the working tree', (t) => {
    const r = repo(t);
    leaky(r);
    rmSync(join(r.work, 'b.txt'));
    rmSync(join(r.work, 'c.txt'));
    assertFindings(r.check(), finding('b.txt contains email'), finding('c.txt contains a home-directory path'));
  });
  await t.test('staged leak with a clean working tree', (t) => {
    const r = repo(t);
    r.write('b.txt', 'clean\n');
    r.commit();
    r.write('b.txt', `contact ${JANE}\n`);
    r.git(['add', 'b.txt']);
    r.write('b.txt', 'clean\n');
    assertFindings(r.check(), finding('b.txt contains email: ', JANE));
  });
  await t.test('working-tree leak not yet staged is still reported', (t) => {
    const r = repo(t);
    r.write('b.txt', 'clean\n');
    r.commit();
    r.write('b.txt', `contact ${JANE}\n`);
    assertFindings(r.check(), finding('b.txt (working tree) contains email: ', JANE));
  });
});

test('check 4 finds home paths without a trailing slash, escaped or forward-slash Windows paths and symlink targets', { skip }, async (t) => {
  const bs = '\\';
  for (const [name, content] of [
    ['a.txt', `cd ${home('janedoe')}\n`],
    ['cwd.json', `{"cwd":"${home('janedoe')}"}\n`],
    ['mac.txt', `cd ${['', 'Users', 'jane'].join('/')}\n`],
    ['win.txt', `${['C:', 'Users', 'jane.doe', 'proj'].join(bs)}\n`],
    ['win.json', `{"cwd": "${['C:', 'Users', 'jane.doe', 'proj'].join(bs + bs)}"}\n`],
    ['fwd.txt', `${['C:', 'Users', 'jane'].join('/')}\n`],
  ]) {
    await t.test(name, (t) => {
      const r = repo(t);
      r.write(name, content);
      r.commit();
      assertFindings(r.check(), finding(`${name} contains a home-directory path`));
    });
  }
  await t.test('tracked symlink whose stored target is a home path', (t) => {
    const r = repo(t);
    symlinkSync(home('janedoe', 'secret.txt'), join(r.work, 'link.txt'));
    r.commit();
    assert.equal(r.git(['cat-file', '-p', 'HEAD:link.txt']), home('janedoe', 'secret.txt'));
    assertFindings(r.check(), finding('link.txt contains a home-directory path'));
  });
});

test('check 4 does not flag bare mentions of the home roots', { skip }, (t) => {
  const r = repo(t);
  r.write('doc.txt', 'Directories such as /home/ and /Users/ hold user data; so does C:\\Users\\ on Windows.\n');
  r.commit();
  assertPass(r.check());
});

// Synthetic stand-in for `exiftool -s -G1 -a <file>`: real exiftool's structural lines, then every line a fixture
// marks with "EXIFTOOL:" (what exiftool would report for it); "EXIFTOOL-EXIT:<n>" sets its exit status. It shadows
// any real exiftool, so these tests mean the same on every machine.
function exiftoolStub(r) {
  const bin = join(r.dir, 'stub-bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'exiftool'), [
    '#!/bin/sh',
    'for f in "$@"; do :; done',
    "printf '[ExifTool]      ExifToolVersion                 : 13.00\\n'",
    "printf '[System]        FileName                        : %s\\n' \"${f##*/}\"",
    "printf '[System]        FileSize                        : 1 kB\\n'",
    "printf '[File]          MIMEType                        : application/octet-stream\\n'",
    "LC_ALL=C grep -a '^EXIFTOOL:' \"$f\" | sed 's/^EXIFTOOL://'",
    "code=$(LC_ALL=C grep -a '^EXIFTOOL-EXIT:' \"$f\" | sed 's/^EXIFTOOL-EXIT://')",
    'exit "${code:-0}"',
    '',
  ].join('\n'));
  chmodSync(join(bin, 'exiftool'), 0o755);
  return { PATH: `${bin}:${process.env.PATH}` };
}
const tag = (group, name, value) => `\nEXIFTOOL:${`[${group}]`.padEnd(16)}${name.padEnd(32)}: ${value}\n`;
const JPEG_EXIF = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x30]), Buffer.from('Exif\0\0MM\0*GPSLatitude 51.5 N synthetic')]);

test('check 6 selects media regardless of extension case and covers audio, video and documents', { skip }, (t) => {
  const r = repo(t);
  const gps = tag('GPS', 'GPSLatitude', '51 deg 30\' 0.00" N');
  const names = ['lower.jpg', 'IMG_0001.JPG', 'IMG_0002.HEIC', 'CLIP.MOV', 'Scan.PDF', 'photo.AVIF', 'raw.dng'];
  for (const name of names) r.write(name, Buffer.concat([JPEG_EXIF, Buffer.from(gps)]));
  r.write('clip.mp3', Buffer.concat([Buffer.from('ID3\x04\0\0\0\0\0\x20TPE1\0\0\0\x0c\0\0\x03Jane Q Real', 'latin1'), Buffer.from(tag('ID3v2_4', 'Artist', 'Jane Q Real'))]));
  r.write('take.wav', Buffer.concat([Buffer.from('RIFF\x24\0\0\0WAVELIST\x10\0\0\0INFOIART\x05\0\0\0Jane\0', 'latin1'), Buffer.from(tag('RIFF', 'Artist', 'Jane'))]));
  r.write('notes.docx', Buffer.concat([Buffer.from('PK\x03\x04\x14\0\0\0\x08\0', 'latin1'), Buffer.from(tag('XML', 'Creator', 'Jane Q Real'))]));
  r.commit();
  const result = r.check(exiftoolStub(r));
  assertFindings(result, ...[...names, 'clip.mp3', 'take.wav', 'notes.docx'].map((name) => finding(`${name} has embedded metadata`)));
});

test('binary files no check can read are listed, not silently passed', { skip }, (t) => {
  const r = repo(t);
  r.write('logs.zip', Buffer.from('PK\x03\x04\x14\0\0\0\x08\0\xff\xfe\x00\x01', 'latin1'));
  r.write('blob.bin', Buffer.from([0, 1, 2, 0xff, 0xfe, 0, 7]));
  r.write('fixture.ots', Buffer.from([0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00]));
  r.commit();
  const result = r.check(exiftoolStub(r));
  assertPass(result);
  const warning = result.stdout.split('\n').find((line) => line.includes('[warn]') && line.includes('not inspected'));
  assert.ok(warning, result.stdout);
  assert.ok(warning.includes('logs.zip') && warning.includes('blob.bin'), warning);
  assert.ok(!warning.includes('fixture.ots'), 'OpenTimestamps receipts carry no metadata fields');
});
