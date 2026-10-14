// Deterministic build (NFR-7, SR-1, SR-3, FR-9). Produces in dist/:
//   web/                       multi-file site (external script/style with SRI)
//   unaltered-<v>.html         single self-contained offline file (inline script/style allowed by CSP hash)
//   unaltered-<v>.zip          multi-file site + single file + Windows helpers, stored (uncompressed) for reproducibility
//   SHA256SUMS                 checksums of the release artefacts
// No timestamps, absolute paths or environment data are embedded in any output.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const workerJs = await bundle('src/core/hash/hasher.worker.ts', {});
const mainMulti = await bundle('src/main.ts', { __WORKER_URL__: JSON.stringify('./hasher.worker.js'), __WORKER_INLINE__: 'null' });
const mainSingle = await bundle('src/main.ts', { __WORKER_URL__: 'null', __WORKER_INLINE__: JSON.stringify(workerJs) });
const css = read('src/styles.css');
const template = read('src/index.html');

const buildHash = hex256(Buffer.from(mainMulti + '\0' + workerJs + '\0' + css + '\0' + template)).slice(0, 16);

function fill(html, { cspValue, styles, script }) {
  return html
    .replace('{{CSP}}', cspValue)
    .replace('{{STYLES}}', styles)
    .replace('{{SCRIPT}}', script)
    .replace('{{VERSION}}', version)
    .replace('{{BUILD}}', buildHash);
}

// Multi-file page: SRI on every script/stylesheet (SR-3).
const sri = (text) => `sha384-${sha(Buffer.from(text), 'sha384', 'base64')}`;
const multiHtml = fill(template, {
  cspValue: csp({ scriptSrc: "'self'", styleSrc: "'self'", workerSrc: "'self'" }),
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
if (/\beval\s*\(|new Function\s*\(/.test(mainMulti.replace(/"(?:[^"\\]|\\.)*"/g, '""'))) throw new Error('eval found in bundle');

// ---- sizes (NFR-3) --------------------------------------------------------------------------------------------
const gz = gzipSync(Buffer.from(mainMulti + workerJs + css), { level: 9 }).length;
if (gz > 150 * 1024) throw new Error(`bundle is ${gz} bytes gzip, above the 150 KiB budget`);

// ---- zip (stored, fixed timestamps) ----------------------------------------------------------------------------
const crcTable = new Uint32Array(256).map((_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function makeZip(entries) {
  const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : 1));
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of sorted) {
    const nameB = Buffer.from(name, 'ascii');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10); // time 00:00:00
    local.writeUInt16LE(0x0021, 12); // date 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameB.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameB, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0, 8);
    c.writeUInt16LE(0, 10);
    c.writeUInt16LE(0, 12);
    c.writeUInt16LE(0x0021, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nameB.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameB);
    offset += local.length + nameB.length + data.length;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(sorted.length, 8);
  end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, ...central, end]);
}

const crlf = (s) => Buffer.from(s.replace(/\r?\n/g, '\r\n'), 'utf8');
const prefix = `unaltered-${version}`;
const singleName = `${prefix}.html`;

const readme = `Unaltered ${version} (build ${buildHash})
=================================

Prove a file existed, unchanged, at a point in time. Your file never leaves your computer.

WINDOWS
  1. Double-click "Open-Unaltered.cmd". It opens ${singleName} in your default browser. No installation, no internet needed for fingerprinting.
  2. To check that your copy is genuine, right-click "Verify-Checksums.ps1" > Run with PowerShell, and compare the
     values with the SHA256SUMS published with the release (signature: SHA256SUMS.sig).
  3. Stamping and verifying need internet access to the OpenTimestamps calendar servers and two Bitcoin block explorers.
     Fingerprinting and cleaning pictures work completely offline.

OTHER SYSTEMS
  Open ${singleName} (single file) or index.html (multi-file site) in any current browser.

PRIVACY
  Stamping is visible to the servers you contact. For sensitive use, use Tor Browser.

Licence: MIT (see LICENSE).
`;
const launcher = `@echo off
rem Opens the offline single-file build in the default browser.
start "" "%~dp0${singleName}"
`;
const psVerify = `# Prints the SHA-256 of every file in this folder next to the value in SHA256SUMS.
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
if ($bad -eq 0) { Write-Host 'All files match.' } else { Write-Host "$bad problem(s). Do not use this copy." }
Read-Host 'Press Enter to close'
`;

const files = [
  { name: 'index.html', data: Buffer.from(multiHtml) },
  { name: 'main.js', data: Buffer.from(mainMulti) },
  { name: 'hasher.worker.js', data: Buffer.from(workerJs) },
  { name: 'styles.css', data: Buffer.from(css) },
  { name: singleName, data: Buffer.from(singleHtml) },
  { name: 'LICENSE', data: Buffer.from(read('LICENSE')) },
  { name: 'README.txt', data: crlf(readme) },
  { name: 'Open-Unaltered.cmd', data: crlf(launcher) },
  { name: 'Verify-Checksums.ps1', data: crlf(psVerify) },
];
const innerSums = files
  .map((f) => `${hex256(f.data)}  ${f.name}`)
  .sort((a, b) => (a.slice(66) < b.slice(66) ? -1 : 1))
  .join('\n') + '\n';
files.push({ name: 'SHA256SUMS', data: Buffer.from(innerSums) });

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'web'), { recursive: true });
for (const f of files) if (['index.html', 'main.js', 'hasher.worker.js', 'styles.css'].includes(f.name)) writeFileSync(join(dist, 'web', f.name), f.data);
writeFileSync(join(dist, singleName), singleHtml);
const zip = makeZip(files.map((f) => ({ name: `${prefix}/${f.name}`, data: f.data })));
writeFileSync(join(dist, `${prefix}.zip`), zip);
const outer = [`${hex256(Buffer.from(singleHtml))}  ${singleName}`, `${hex256(zip)}  ${prefix}.zip`].sort().join('\n') + '\n';
writeFileSync(join(dist, 'SHA256SUMS'), outer);

process.stdout.write(`built ${prefix} (build ${buildHash}); gzip ${(gz / 1024).toFixed(1)} KiB; single-file ${(singleHtml.length / 1024).toFixed(0)} KiB\n`);
