#!/usr/bin/env node
// Package the web build as a standalone desktop app (ADR-008).
//
//   node scripts/build-windows.mjs                 -> release/Unaltered-<ver>-win32-x64.zip
//   node scripts/build-windows.mjs --platform linux  (same shell for Linux; used for smoke tests)
//
// The Electron runtime is downloaded from the official GitHub release and checked against
// a SHA-256 pinned in this file (taken from the release's SHASUMS256.txt). No npm packages
// are installed and no install scripts run. Set ELECTRON_ZIP=<path> to use a local copy
// (it is still hash-checked). Needs `unzip` and `zip` on PATH (Linux/macOS build hosts).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ELECTRON_VERSION = '44.4.5';
const PINNED = {
  win32: '11c395820a5aaa8ebcc0686b476d0ac98a730274ebfbdc8cf5538a7c2815cb5d',
  linux: '04586a0ec46c3283fbdaef85530f561f71f0b5e136ad0cb9ef63683615609780',
};
// Fixed timestamp for archive entries so the zip is reproducible (2026-01-01T00:00:00Z
// unless SOURCE_DATE_EPOCH is set).
const EPOCH = Number(process.env.SOURCE_DATE_EPOCH ?? 1767225600);

const args = process.argv.slice(2);
const platform = args.includes('--platform') ? args[args.indexOf('--platform') + 1] : 'win32';
if (!(platform in PINNED)) fail(`unsupported platform: ${platform}`);
const arch = 'x64';

function fail(msg) {
  console.error(`build-windows: ${msg}`);
  process.exit(1);
}

function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

function allowlistHosts() {
  const src = readFileSync(join(ROOT, 'src/core/net/allowlist.ts'), 'utf8');
  const block = src.match(/ALLOWED_HOSTS[^=]*=\s*\[([\s\S]*?)\]/);
  if (!block) fail('could not read ALLOWED_HOSTS from src/core/net/allowlist.ts');
  const hosts = [...block[1].matchAll(/'([a-z0-9.-]+)'/g)].map((m) => m[1]);
  if (hosts.length === 0) fail('empty allowlist');
  return hosts;
}

async function getElectronZip() {
  const name = `electron-v${ELECTRON_VERSION}-${platform}-${arch}.zip`;
  const cacheDir = join(ROOT, '.cache', 'electron');
  const cached = process.env.ELECTRON_ZIP ?? join(cacheDir, name);
  if (!existsSync(cached)) {
    if (process.env.ELECTRON_ZIP) fail(`ELECTRON_ZIP not found: ${cached}`);
    mkdirSync(cacheDir, { recursive: true });
    const url = `https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/${name}`;
    console.log(`downloading ${url}`);
    execFileSync('curl', ['-fsSL', '--retry', '3', '-o', cached + '.part', url], { stdio: 'inherit' });
    renameSync(cached + '.part', cached);
  }
  const got = sha256File(cached);
  if (got !== PINNED[platform]) {
    fail(`Electron archive hash mismatch for ${name}\n  expected ${PINNED[platform]}\n  got      ${got}`);
  }
  return cached;
}

function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk(dir);
  return out;
}

function setTimes(dir) {
  for (const f of listFiles(dir)) utimesSync(f, EPOCH, EPOCH);
  const dirs = [dir];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) { dirs.push(p); walk(p); }
    }
  };
  walk(dir);
  for (const d of dirs) utimesSync(d, EPOCH, EPOCH);
}

async function main() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const version = pkg.version;
  const webDir = join(ROOT, 'dist', 'web');
  if (!existsSync(join(webDir, 'index.html'))) {
    console.log('dist/web missing; running web build first');
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'build.mjs')], { stdio: 'inherit', cwd: ROOT });
  }

  const zip = await getElectronZip();
  const name = `Unaltered-${version}-${platform}-${arch}`;
  const releaseDir = join(ROOT, 'release');
  const outDir = join(releaseDir, name);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  execFileSync('unzip', ['-q', zip, '-d', outDir], { stdio: 'inherit' });

  // Rename the runtime executable and drop Electron's demo app.
  const exeFrom = platform === 'win32' ? 'electron.exe' : 'electron';
  const exeTo = platform === 'win32' ? 'Unaltered.exe' : 'unaltered';
  renameSync(join(outDir, exeFrom), join(outDir, exeTo));
  rmSync(join(outDir, 'resources', 'default_app.asar'), { force: true });

  const appDir = join(outDir, 'resources', 'app');
  mkdirSync(appDir, { recursive: true });
  cpSync(join(ROOT, 'desktop', 'main.cjs'), join(appDir, 'main.cjs'));
  cpSync(join(ROOT, 'desktop', 'policy.cjs'), join(appDir, 'policy.cjs'));
  cpSync(webDir, join(appDir, 'web'), { recursive: true });
  writeFileSync(join(appDir, 'allowlist.json'), JSON.stringify({ hosts: allowlistHosts() }, null, 2) + '\n');
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({
    name: 'unaltered',
    productName: 'Unaltered',
    version,
    description: pkg.description,
    license: pkg.license,
    main: 'main.cjs',
    private: true,
  }, null, 2) + '\n');
  cpSync(join(ROOT, 'LICENSE'), join(outDir, 'LICENSE.unaltered.txt'));
  writeFileSync(join(outDir, 'README.txt'), [
    `Unaltered ${version} (desktop, ${platform}-${arch})`,
    '',
    `Run ${exeTo}${platform === 'win32' ? ' (no installation needed; keep this folder together)' : ''}.`,
    '',
    'This is the same app as the web version, wrapped in the Electron runtime',
    `v${ELECTRON_VERSION}. Your files never leave this computer; only fingerprints are sent`,
    'to OpenTimestamps calendars, and block headers are read from public explorers.',
    'Network access is limited to those servers. See LICENSE.unaltered.txt, and',
    'LICENSE / LICENSES.chromium.html for the Electron runtime.',
    '',
    'Verify this download against the published SHA256SUMS before use.',
    '',
  ].join('\r\n'));

  setTimes(outDir);
  const zipPath = join(releaseDir, `${name}.zip`);
  rmSync(zipPath, { force: true });
  const entries = listFiles(outDir).map((f) => relative(releaseDir, f));
  // -X: no extra attributes (uid/gid, extended timestamps) so the archive is reproducible.
  execFileSync('zip', ['-q', '-X', '-D', zipPath, '-@'], { cwd: releaseDir, input: entries.join('\n') + '\n' });
  const sum = sha256File(zipPath);
  writeFileSync(join(releaseDir, `${name}.zip.sha256`), `${sum}  ${name}.zip\n`);
  console.log(`built release/${name}.zip\n${sum}`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
