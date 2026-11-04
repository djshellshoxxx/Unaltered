// Deterministic build (NFR-7, SR-1, SR-3, FR-9). Produces in dist/:
//   web/                       multi-file site (external script/style with SRI; the hash worker is inside main.js)
//   unaltered-<v>.html         single self-contained offline file (inline script/style allowed by CSP hash)
//   unaltered-<v>.zip          Windows package: site + single file + .cmd launcher + PowerShell checksum helper (stored zip)
//   unaltered-<v>-linux.tar.gz Linux package: site + single file + xdg-open launcher + checksum script
//   unaltered-<v>-macos.zip    macOS package: site + single file + .command launcher + checksum script
//   SHA256SUMS                 checksums of the release artefacts
// No timestamps, absolute paths or environment data are embedded in any output.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTarGz, makeZip } from './lib/archive.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const read = (p) => readFileSync(join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const version = pkg.version;

const sha = (data, algo, enc) => createHash(algo).update(data).digest(enc);
const hex256 = (d) => sha(d, 'sha256', 'hex');

// ---- allowlist (single source of truth for connect-src) -------------------------------------------------------
const allowlistSrc = read('src/core/net/allowlist.ts');
const hosts = [...allowlistSrc.matchAll(/host:\s*'([^']+)'/g)].map((m) => m[1]);
if (hosts.length < 3) throw new Error('could not read allowlist');
const connectSrc = hosts.map((h) => `https://${h}`).join(' ');

function csp({ scriptSrc, styleSrc, workerSrc }) {
  return [
    "default-src 'none'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' blob:",
    `connect-src ${connectSrc}`,
    `worker-src ${workerSrc}`,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
    'trusted-types unaltered-worker',
  ].join('; ');
}

// ---- bundles --------------------------------------------------------------------------------------------------
async function bundle(entry, define) {
  const res = await build({
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    platform: 'browser',
    minify: true,
    legalComments: 'none',
    charset: 'ascii',
    sourcemap: false,
    define,
    logLevel: 'error',
  });
  if (res.outputFiles.length !== 1) throw new Error('unexpected esbuild output');
  return res.outputFiles[0].text;
}

// Both pages start the hash worker from a blob: URL of this source, inlined in the page script. A blob: worker inherits
// the page's CSP and Trusted Types, and its code is pinned by main.js's SRI hash or the single file's CSP hash. A worker
// loaded from its own URL would take its CSP only from HTTP headers, which static hosts do not send, and
// `new Worker(url)` has no integrity check (SR-1, SR-3).
const workerJs = await bundle('src/core/hash/hasher.worker.ts', {});
const mainSingle = await bundle('src/main.ts', { __WORKER_URL__: 'null', __WORKER_INLINE__: JSON.stringify(workerJs) });
const mainMulti = mainSingle;
const cliJs = (
  await build({ absWorkingDir: root, entryPoints: ['src/cli/main.ts'], bundle: true, write: false, format: 'esm', target: 'node22', platform: 'node', minify: true, legalComments: 'none', charset: 'ascii', logLevel: 'error', banner: { js: '#!/usr/bin/env node' } })
).outputFiles[0].text;
const cliName = `unaltered-cli-${version}.mjs`;
const css = read('src/styles.css');
const template = read('src/index.html');

const buildHash = hex256(Buffer.from(cliJs + '\0' + mainMulti + '\0' + workerJs + '\0' + css + '\0' + template)).slice(0, 16);

// One pass with a replacer function: string replacements would expand `$&`, `$'` and similar patterns inside the
// bundle or CSS, and sequential passes would fill a token that an earlier value happened to contain.
function fill(html, { cspValue, styles, script }) {
  const values = { CSP: cspValue, STYLES: styles, SCRIPT: script, VERSION: version, BUILD: buildHash };
  return html.replace(/\{\{(CSP|STYLES|SCRIPT|VERSION|BUILD)\}\}/g, (_, key) => values[key]);
}

// Multi-file page: SRI on every script/stylesheet (SR-3).
const sri = (text) => `sha384-${sha(Buffer.from(text), 'sha384', 'base64')}`;
const multiHtml = fill(template, {
  cspValue: csp({ scriptSrc: "'self'", styleSrc: "'self'", workerSrc: 'blob:' }),
  styles: `<link rel="stylesheet" href="./styles.css" integrity="${sri(css)}">`,
  script: `<script src="./main.js" defer integrity="${sri(mainMulti)}"></script>`,
});

// Single-file page: inline script/style, allowed by hash in the CSP; no 'unsafe-inline'.
for (const [name, text] of [['main', mainSingle], ['css', css]]) {
  if (/<\/script|<\/style|<!--/i.test(text)) throw new Error(`${name} contains a sequence that could break out of an inline block`);
}
const b64 = (text) => sha(Buffer.from(text), 'sha256', 'base64');
const singleHtml = fill(template, {
  cspValue: csp({ scriptSrc: `'sha256-${b64(mainSingle)}'`, styleSrc: `'sha256-${b64(css)}'`, workerSrc: 'blob:' }),
  styles: `<style>${css}</style>`,
  script: `<script>${mainSingle}</script>`,
});

// ---- gates (SR-3 / SR-4) --------------------------------------------------------------------------------------
if (/<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/i.test(multiHtml.replace(/<!--[\s\S]*?-->/g, ''))) throw new Error('inline script in multi-file build');
if (/<style[\s>]/i.test(multiHtml) || /\sstyle\s*=/i.test(multiHtml)) throw new Error('inline style in multi-file build');
for (const html of [multiHtml, singleHtml]) {
  if (/\son[a-z]+\s*=/i.test(html.replace(/<script>[\s\S]*?<\/script>/g, ''))) throw new Error('inline event handler found');
  if (/unsafe-inline|unsafe-eval/.test(html.match(/Content-Security-Policy" content="([^"]*)"/)[1])) throw new Error("CSP contains 'unsafe-*'");
  if (/\{\{[A-Z]+\}\}/.test(html.replace(/<script>[\s\S]*?<\/script>/g, ''))) throw new Error('unfilled template token');
}
// The single-file CSP allows exactly these hashes, so the inlined bytes must be exactly the hashed bytes.
const inlined = (tag) => [...singleHtml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1]);
if (JSON.stringify(inlined('script')) !== JSON.stringify([mainSingle])) throw new Error('single-file inline script differs from its CSP-hashed bundle');
if (JSON.stringify(inlined('style')) !== JSON.stringify([css])) throw new Error('single-file inline style differs from its CSP-hashed stylesheet');
if (/\beval\s*\(|new Function\s*\(/.test(mainMulti.replace(/"(?:[^"\\]|\\.)*"/g, '""'))) throw new Error('eval found in bundle');

// ---- sizes (NFR-3) --------------------------------------------------------------------------------------------
const gz = gzipSync(Buffer.from(mainMulti + css), { level: 9 }).length;
if (gz > 150 * 1024) throw new Error(`bundle is ${gz} bytes gzip, above the 150 KiB budget`);

const crlf = (s) => Buffer.from(s.replace(/\r?\n/g, '\r\n'), 'utf8');
const prefix = `unaltered-${version}`;
const singleName = `${prefix}.html`;
// `<prefix>.zip` is the Windows package (name kept for compatibility); the others carry their OS in the name.
const archive = { windows: `${prefix}.zip`, linux: `${prefix}-linux.tar.gz`, macos: `${prefix}-macos.zip` };

const readme = `Unaltered ${version} (build ${buildHash})
=================================

Prove a file existed, unchanged, at a point in time. Your file never leaves your computer.

WINDOWS
  1. To check that your copy is genuine, check the zip you downloaded, not this folder: in PowerShell run
     Get-FileHash ${archive.windows} and compare the value with the line for ${archive.windows} in the SHA256SUMS
     published with the release (signature: SHA256SUMS.sig). Letter case does not matter.
  2. Double-click "Open-Unaltered.cmd". It opens ${singleName} in your default browser. No installation, no internet needed for fingerprinting.
  3. Stamping and verifying need internet access to the OpenTimestamps calendar servers and two Bitcoin block explorers.
     Fingerprinting and cleaning pictures work completely offline.
  "Verify-Checksums.ps1" (right-click > Run with PowerShell) only compares this folder with the SHA256SUMS inside the
  same zip: it finds damaged or incomplete copies, not deliberate changes.

LINUX / MACOS
  To check that your copy is genuine, compare the archive you downloaded with the SHA256SUMS published with the release
  (signature: SHA256SUMS.sig): run sha256sum ${archive.linux} on Linux or shasum -a 256 ${archive.macos} on macOS.
  Linux: run "sh open-unaltered.sh". macOS: right-click "Open-Unaltered.command" > Open (first time).
  "verify-checksums.sh" only compares this folder with the SHA256SUMS inside the same archive: it finds damaged or
  incomplete copies, not deliberate changes.
  Command line (Node 22+): node unaltered-cli-${version}.mjs verify <file> [receipt.ots]

OTHER SYSTEMS
  Open ${singleName} in any current browser.

MULTI-FILE SITE
  The files index.html, main.js and styles.css are the multi-file site for a web server: browsers refuse to run it when
  index.html is opened from disk, because its integrity-checked script and style cannot be loaded from file://.

PRIVACY
  Stamping is visible to the servers you contact. For sensitive use, use Tor Browser.

Licence: MIT (see LICENSE).
`;
const launcher = `@echo off
rem Opens the offline single-file build in the default browser.
start "" "%~dp0${singleName}"
`;
const psVerify = `# Compares every file listed in this folder's SHA256SUMS with that list. Prints OK, MISMATCH or MISSING per file.
# This finds damaged or incomplete copies. It cannot show that the copy is genuine, because a changed copy can come with
# a matching SHA256SUMS: for that, compare the downloaded zip with the SHA256SUMS published with the release.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$sums = Get-Content -Path (Join-Path $here 'SHA256SUMS')
$bad = 0
foreach ($line in $sums) {
  if ($line -match '^([0-9a-f]{64})\\s+\\*?(.+)$') {
    $expected = $Matches[1]; $name = $Matches[2]
    $path = Join-Path $here $name
    if (-not (Test-Path $path)) { Write-Host "MISSING  $name"; $bad++; continue }
    $actual = (Get-FileHash -Algorithm SHA256 -Path $path).Hash.ToLower()
    if ($actual -eq $expected) { Write-Host "OK       $name" } else { Write-Host "MISMATCH $name"; $bad++ }
  }
}
if ($bad -eq 0) {
  Write-Host "All files match this folder's SHA256SUMS."
  Write-Host 'This does not show that the copy is genuine: compare ${archive.windows} with the SHA256SUMS published with the release.'
} else { Write-Host "$bad problem(s). Do not use this copy." }
Read-Host 'Press Enter to close'
`;

const lf = (s) => Buffer.from(s, 'utf8');
const shLauncher = (open) => `#!/bin/sh
# Opens the offline single-file build in the default browser.
dir=$(cd "$(dirname "$0")" && pwd)
${open}
`;
const linuxLauncher = shLauncher(`if command -v xdg-open >/dev/null 2>&1; then xdg-open "$dir/${singleName}"; else echo "Open $dir/${singleName} in a browser."; fi`);
const macLauncher = shLauncher(`open "$dir/${singleName}"`);
const shVerify = (sumCmd, name) => `#!/bin/sh
# Compares every file listed in this folder's SHA256SUMS with that list. Prints OK/FAILED per file.
# This finds damaged or incomplete copies. It cannot show that the copy is genuine, because a changed copy can come with
# a matching SHA256SUMS: for that, compare the downloaded archive with the SHA256SUMS published with the release.
cd "$(dirname "$0")" || exit 1
if ${sumCmd}; then
  echo "All files match this folder's SHA256SUMS."
  echo "This does not show that the copy is genuine: compare ${name} with the SHA256SUMS published with the release."
else
  echo "Problem(s) found. Do not use this copy." >&2
  exit 1
fi
`;

const common = [
  { name: 'index.html', data: Buffer.from(multiHtml) },
  { name: 'main.js', data: Buffer.from(mainMulti) },
  { name: 'styles.css', data: Buffer.from(css) },
  { name: singleName, data: Buffer.from(singleHtml) },
  { name: 'LICENSE', data: Buffer.from(read('LICENSE')) },
  { name: cliName, data: Buffer.from(cliJs), mode: 0o755 },
];
const withSums = (extra) => {
  const files = [...common, ...extra];
  const sums = files
    .map((f) => `${hex256(f.data)}  ${f.name}`)
    .sort((a, b) => (a.slice(66) < b.slice(66) ? -1 : 1))
    .join('\n') + '\n';
  return [...files, { name: 'SHA256SUMS', data: Buffer.from(sums) }];
};
const prefixed = (files) => files.map((f) => ({ name: `${prefix}/${f.name}`, data: f.data, mode: f.mode }));

const windowsFiles = withSums([
  { name: 'README.txt', data: crlf(readme) },
  { name: 'Open-Unaltered.cmd', data: crlf(launcher) },
  { name: 'Verify-Checksums.ps1', data: crlf(psVerify) },
]);
const linuxFiles = withSums([
  { name: 'README.txt', data: lf(readme) },
  { name: 'open-unaltered.sh', data: lf(linuxLauncher), mode: 0o755 },
  { name: 'verify-checksums.sh', data: lf(shVerify('sha256sum -c SHA256SUMS', archive.linux)), mode: 0o755 },
]);
const macFiles = withSums([
  { name: 'README.txt', data: lf(readme) },
  { name: 'Open-Unaltered.command', data: lf(macLauncher), mode: 0o755 },
  { name: 'verify-checksums.sh', data: lf(shVerify('shasum -a 256 -c SHA256SUMS', archive.macos)), mode: 0o755 },
]);

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'web'), { recursive: true });
for (const f of common) if (f.name !== singleName && f.name !== 'LICENSE' && f.name !== cliName) writeFileSync(join(dist, 'web', f.name), f.data);
writeFileSync(join(dist, singleName), singleHtml);
writeFileSync(join(dist, cliName), cliJs);
const artefacts = [
  [archive.windows, makeZip(prefixed(windowsFiles))],
  [archive.linux, makeTarGz(prefixed(linuxFiles))],
  [archive.macos, makeZip(prefixed(macFiles))],
];
for (const [name, data] of artefacts) writeFileSync(join(dist, name), data);
const outer = [[singleName, Buffer.from(singleHtml)], [cliName, Buffer.from(cliJs)], ...artefacts].map(([n, d]) => `${hex256(d)}  ${n}`).sort().join('\n') + '\n';
writeFileSync(join(dist, 'SHA256SUMS'), outer);

process.stdout.write(`built ${prefix} (build ${buildHash}); gzip ${(gz / 1024).toFixed(1)} KiB; single-file ${(singleHtml.length / 1024).toFixed(0)} KiB\n`);
