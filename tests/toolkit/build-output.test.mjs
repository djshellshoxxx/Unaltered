// Checks on what `npm run build` ships (SR-1, SR-3, SR-4, SPEC 13, docs/RELEASE.md). Each build runs on a private copy
// of the build inputs in a temporary folder, so the repository's dist/ is never read or written. Tests that need other
// inputs change only their own copy.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const { version } = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
const prefix = `unaltered-${version}`;
const scratch = [];
const links = [];
after(() => {
  // Remove the links to the shared node_modules first, so cleanup can never reach into it.
  for (const link of links) unlinkSync(link);
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'unaltered-build-test-'));
  scratch.push(dir);
  return dir;
}

/** Builds a private copy of the sources. `edit(dir)` may change the copy first. */
function build(edit) {
  const dir = tempDir();
  for (const p of ['src', 'scripts', 'package.json', 'LICENSE', 'tsconfig.json']) cpSync(join(repo, p), join(dir, p), { recursive: true });
  symlinkSync(join(repo, 'node_modules'), join(dir, 'node_modules'), 'junction');
  links.push(join(dir, 'node_modules'));
  edit?.(dir);
  const run = spawnSync(process.execPath, [join('scripts', 'build.mjs')], { cwd: dir, encoding: 'utf8' });
  return { status: run.status, output: `${run.stdout}${run.stderr}`, dist: join(dir, 'dist') };
}

/** Entries of a stored zip as scripts/lib/archive.mjs writes it: local headers in order, no compression. */
function unzip(buf) {
  const files = new Map();
  for (let at = 0; buf.readUInt32LE(at) === 0x04034b50;) {
    const size = buf.readUInt32LE(at + 18);
    const nameLength = buf.readUInt16LE(at + 26);
    const start = at + 30 + nameLength + buf.readUInt16LE(at + 28);
    files.set(buf.toString('ascii', at + 30, at + 30 + nameLength), buf.subarray(start, start + size));
    at = start + size;
  }
  return files;
}

function untar(gz) {
  const buf = gunzipSync(gz);
  const files = new Map();
  for (let at = 0; at + 512 <= buf.length && buf[at] !== 0;) {
    const name = buf.toString('ascii', at, at + 100).replace(/\0[\s\S]*$/, '');
    const size = parseInt(buf.toString('ascii', at + 124, at + 136), 8);
    files.set(name, buf.subarray(at + 512, at + 512 + size));
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

const text = (buf) => buf.toString('utf8').replace(/\r\n/g, '\n');
const sri = (buf) => `sha384-${createHash('sha384').update(buf).digest('base64')}`;
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const parseSums = (s) => new Map(s.trim().split('\n').map((line) => /^([0-9a-f]{64}) {2}(.+)$/.exec(line)).map((m) => [m[2], m[1]]));
const cspOf = (html) => Object.fromEntries(
  /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)[1].split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]),
);
const scriptTags = (html) => [...html.matchAll(/<script\b([^>]*)>/g)]
  .map((m) => Object.fromEntries([...m[1].matchAll(/([a-z-]+)(?:="([^"]*)")?/g)].map((a) => [a[1], a[2] ?? ''])));
const buildCode = (html) => /<span id="build-hash">([^<]*)<\/span>/.exec(html)[1];
/** README text as sentences: wrapped lines joined, split after a full stop that ends a sentence. */
const sentences = (s) => s.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"])/);

const base = build();
assert.equal(base.status, 0, base.output);
const web = new Map(readdirSync(join(base.dist, 'web')).map((n) => [n, readFileSync(join(base.dist, 'web', n))]));
const singleHtml = readFileSync(join(base.dist, `${prefix}.html`), 'utf8');
const publishedSums = readFileSync(join(base.dist, 'SHA256SUMS'), 'utf8');
const packages = [
  { os: 'windows', archive: `${prefix}.zip`, open: unzip, helper: 'Verify-Checksums.ps1' },
  { os: 'linux', archive: `${prefix}-linux.tar.gz`, open: untar, helper: 'verify-checksums.sh' },
  { os: 'macos', archive: `${prefix}-macos.zip`, open: unzip, helper: 'verify-checksums.sh' },
].map((p) => {
  const all = p.open(readFileSync(join(base.dist, p.archive)));
  const files = new Map([...all].map(([name, data]) => [name.slice(prefix.length + 1), data]));
  return { ...p, files };
});

// ---- 1. the hashing worker is covered by SRI and by the page CSP --------------------------------------------------

/** Every script file the site serves must be loaded by a <script> whose SRI hash pins its exact bytes. */
function assertScriptsPinned(where, files) {
  const html = text(files.get('index.html'));
  const tags = scriptTags(html);
  for (const [name, data] of files) {
    if (!name.endsWith('.js')) continue;
    const tag = tags.find((t) => t.src === `./${name}`);
    assert.ok(tag, `${where}: ${name} is served but index.html loads it with no <script integrity> (SR-3)`);
    assert.equal(tag.integrity, sri(data), `${where}: ${name} SRI hash`);
  }
}

test('every script file in the multi-file site is pinned by SRI from index.html (SR-3)', () => {
  assertScriptsPinned('dist/web', web);
  for (const p of packages) assertScriptsPinned(p.archive, p.files);
});

test('workers may start only from blob: URLs, which inherit the page CSP and Trusted Types (SR-1)', () => {
  // A worker loaded from its own URL takes its policy from that response's HTTP headers, never from this <meta> CSP.
  for (const [where, html] of [['dist/web/index.html', text(web.get('index.html'))], [`${prefix}.html`, singleHtml]]) {
    assert.deepEqual(cspOf(html)['worker-src'], ['blob:'], `${where} worker-src`);
  }
});

// ---- 2. package checksum helpers and the genuineness check ------------------------------------------------------

test('each package README checks genuineness on the downloaded archive against the published SHA256SUMS', () => {
  const published = parseSums(publishedSums);
  for (const p of packages) {
    assert.equal(published.get(p.archive), sha256(readFileSync(join(base.dist, p.archive))), `${p.archive} is in the published SHA256SUMS`);
    const genuine = sentences(text(p.files.get('README.txt'))).filter((s) => /genuine/i.test(s));
    assert.ok(genuine.length > 0, `${p.os}: README says how to check that the copy is genuine`);
    for (const s of genuine.filter((x) => !/\b(?:not|cannot)\b/.test(x))) {
      assert.doesNotMatch(s, /verify-checksums/i, `${p.os}: the in-folder helper cannot establish genuineness: "${s}"`);
    }
    assert.ok(genuine.some((s) => s.includes(p.archive) && s.includes('SHA256SUMS')),
      `${p.os}: README checks ${p.archive} against the published SHA256SUMS; got ${JSON.stringify(genuine)}`);
  }
});

test('each package README says its checksum helper only compares the folder with its own SHA256SUMS', () => {
  for (const p of packages) {
    const about = sentences(text(p.files.get('README.txt'))).filter((s) => s.includes(p.helper));
    assert.ok(about.some((s) => /\bonly\b/.test(s) && /SHA256SUMS inside/.test(s)), `${p.os}: ${JSON.stringify(about)}`);
  }
});

test('Verify-Checksums.ps1 describes what it does and says that a match is not proof of genuineness', () => {
  const ps1 = text(packages[0].files.get('Verify-Checksums.ps1'));
  const header = ps1.split('\n').filter((l) => l.startsWith('#')).join(' ');
  if (/prints the sha-256/i.test(header)) assert.match(ps1, /Write-Host[^\n]*\$actual/, 'header claims hash values are printed');
  assert.match(ps1, /Write-Host[^\n]*published[^\n]*\n/, 'the result points to the published SHA256SUMS');
  assert.ok(ps1.includes(`${prefix}.zip`), 'the result names the archive to check');
});

test('verify-checksums.sh on a changed copy with a regenerated SHA256SUMS does not report it as genuine', (t) => {
  if (process.platform === 'win32' || spawnSync('sha256sum', ['--version']).error) return t.skip('needs sh and sha256sum');
  const linux = packages[1];
  const dir = tempDir();
  for (const [name, data] of linux.files) writeFileSync(join(dir, name), data);
  chmodSync(join(dir, 'verify-checksums.sh'), 0o755);
  // Synthetic tampering, as a redistributor could do it: change a file, then regenerate the folder's own list.
  appendFileSync(join(dir, 'main.js'), '\n/* changed */\n');
  const names = [...linux.files.keys()].filter((n) => n !== 'SHA256SUMS').sort();
  writeFileSync(join(dir, 'SHA256SUMS'), names.map((n) => `${sha256(readFileSync(join(dir, n)))}  ${n}`).join('\n') + '\n');
  const run = spawnSync('sh', [join(dir, 'verify-checksums.sh')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr); // Self-consistent: the helper cannot detect this, so it must say so.
  assert.match(run.stdout, /published/);
  assert.ok(run.stdout.includes(linux.archive), run.stdout);
});

// ---- 3. index.html is not offered for opening from disk ----------------------------------------------------------

test('package READMEs say the multi-file index.html needs a web server (SRI blocks it from disk)', () => {
  for (const p of packages) {
    for (const s of sentences(text(p.files.get('README.txt'))).filter((x) => x.includes('index.html'))) {
      assert.match(s, /web server/, `${p.os}: "${s}"`);
    }
  }
});

// ---- 4. the footer build code is published and covers the CSP ---------------------------------------------------

test('the footer build code is published with the release checksums', () => {
  const code = buildCode(text(web.get('index.html')));
  assert.match(code, /^[0-9a-f]{16}$/);
  assert.equal(buildCode(singleHtml), code);
  const notesPath = join(base.dist, 'RELEASE-NOTES.md');
  assert.ok(existsSync(notesPath), 'the build writes the release notes that carry the build code');
  const notes = readFileSync(notesPath, 'utf8');
  assert.match(notes, new RegExp(`Build code[^\\n]*\\b${code}\\b`));
  for (const line of publishedSums.trim().split('\n')) assert.ok(notes.includes(line), `notes list ${line}`);
  const release = readFileSync(join(repo, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.match(release, /dist\/RELEASE-NOTES\.md/, 'the release build uploads the notes');
  assert.match(release, /--notes-file\s+\S+/, 'the draft release uses the generated notes');
  assert.match(release, /linux\/RELEASE-NOTES\.md/, 'the draft notes come from the checked Linux build');
});

test('the build code changes when only the CSP changes', () => {
  const edited = build((dir) => {
    const path = join(dir, 'scripts', 'build.mjs');
    const before = readFileSync(path, 'utf8');
    const after = before.replace(`"img-src 'self' blob:"`, `"img-src 'self' blob: data:"`);
    assert.notEqual(after, before, 'test edit applies');
    writeFileSync(path, after);
  });
  assert.equal(edited.status, 0, edited.output);
  const html = readFileSync(join(edited.dist, 'web', 'index.html'), 'utf8');
  assert.notDeepEqual(cspOf(html), cspOf(text(web.get('index.html'))));
  assert.notEqual(buildCode(html), buildCode(text(web.get('index.html'))));
  assert.notEqual(buildCode(readFileSync(join(edited.dist, `${prefix}.html`), 'utf8')), buildCode(singleHtml));
});

// ---- 5. the SR-4 bundle gate covers every bundle and every string-to-code form ---------------------------------

for (const [label, file, line] of [
  ['Function() called without new in the hashing worker', 'src/core/hash/hasher.worker.ts', "(globalThis as Record<string, unknown>).probe = Function('return this')();"],
  ['an indirect eval in the hashing worker', 'src/core/hash/hasher.worker.ts', "(globalThis as Record<string, unknown>).probe = (0, eval)('6*7');"],
  ['an indirect eval in the page script', 'src/main.ts', "(globalThis as Record<string, unknown>).probe = (0, eval)('6*7');"],
  // The old gate skipped "string literals" by quote matching, lost track at a quote inside another literal, and missed
  // even this at the end of the page script.
  ['new Function in the page script', 'src/main.ts', "(globalThis as Record<string, unknown>).probe = new Function('return 1');"],
  ['Function() called without new in the CLI', 'src/cli/main.ts', "(globalThis as Record<string, unknown>).probe = Function('return this')();"],
]) {
  test(`the build refuses ${label} (SR-4)`, () => {
    const r = build((dir) => appendFileSync(join(dir, file), `\n${line}\n`));
    assert.notEqual(r.status, 0, `build succeeded: ${r.output}`);
    assert.match(r.output, /eval found in bundle/);
    assert.equal(existsSync(join(r.dist, 'SHA256SUMS')), false);
  });
}
