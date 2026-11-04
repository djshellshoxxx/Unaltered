// Static regressions for what the required CI gates actually check. Offline, no YAML dependency: the readers below
// understand only the layout this repository's workflows use, and fail closed when a job or step is not found.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n');
const version = JSON.parse(read('package.json')).version;
/** The lines of job `name` (two-space indent under `jobs:`), up to the next job or top-level key. */
function job(workflow, name) {
  const lines = read(workflow).split('\n');
  const start = lines.indexOf(`  ${name}:`, lines.indexOf('jobs:'));
  assert.ok(lines.includes('jobs:') && start !== -1, `${workflow} has no job ${name}`);
  let end = start + 1;
  while (end < lines.length && !/^ {0,2}\S/.test(lines[end])) end++;
  return lines.slice(start + 1, end);
}

/** Steps of a job as { key: value } with `run: |` blocks dedented. Keys sit at eight spaces, block bodies at ten. */
function steps(jobLines) {
  const raw = [];
  for (const line of jobLines) {
    if (/^ {6}- /.test(line)) raw.push([line.replace(/^ {6}- /, ' '.repeat(8))]);
    else if (raw.length && (line.startsWith(' '.repeat(8)) || line.trim() === '')) raw[raw.length - 1].push(line);
  }
  return raw.map((lines) => {
    const step = {};
    for (let i = 0; i < lines.length; i++) {
      const m = /^ {8}([\w-]+):(?: (.*))?$/.exec(lines[i]);
      if (!m) continue;
      const value = m[2] ?? '';
      if (value === '|') {
        const body = [];
        while (i + 1 < lines.length && (lines[i + 1].startsWith(' '.repeat(10)) || lines[i + 1].trim() === '')) body.push(lines[++i].slice(10));
        step[m[1]] = body.join('\n').trimEnd();
      } else step[m[1]] = value.replace(/^"(.*)"$/, '$1');
    }
    return step;
  });
}

/** Case-insensitive PowerShell-style wildcard (`*`, `?`) as an anchored RegExp. */
const wildcard = (pattern) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('the Windows job checks the Windows zip itself, with the Verify-Checksums.ps1 it ships', () => {
  const build = read('scripts/build.mjs');
  const packages = [...build.matchAll(/\[`\$\{prefix\}([^`]*)`,\s*make\w+\(prefixed\((\w+)\)\)\]/g)]
    .map(([, suffix, files]) => ({ name: `unaltered-${version}${suffix}`, files }));
  const windowsZip = packages.find((p) => p.files === 'windowsFiles')?.name;
  assert.ok(windowsZip, 'scripts/build.mjs no longer names the package built from windowsFiles');
  const dist = [...packages.map((p) => p.name), `unaltered-${version}.html`, `unaltered-cli-${version}.mjs`, 'SHA256SUMS'];
  assert.ok(dist.filter((n) => n.endsWith('.zip')).length > 1, 'expected the Windows and macOS zips side by side in dist/');

  const step = steps(job('.github/workflows/ci.yml', 'windows')).find((s) => s.shell === 'pwsh' && /Expand-Archive/.test(s.run ?? ''));
  assert.ok(step, 'the Windows job has no native (pwsh) step that expands a built zip');
  const script = step.run;
  const problems = [];

  // Every dist/ path the step opens must select exactly the Windows package. A wildcard such as dist/unaltered-*.zip
  // also matches unaltered-<v>-macos.zip, which PowerShell's name-sorted listing returns first.
  const versionFromPackageJson = /\$version\s*=\s*\(Get-Content\b[^)]*\bpackage\.json\b[^)]*\|\s*ConvertFrom-Json\)\.version\b/.test(script);
  const refs = [...script.matchAll(/dist[\\/]([^\s'"`|),;]+)/g)].map((m) => m[1]);
  if (refs.length === 0) problems.push('opens nothing under dist/');
  for (const ref of refs) {
    const resolved = versionFromPackageJson ? ref.replace(/\$\{?version\}?/g, version) : ref;
    const selected = dist.filter((n) => wildcard(resolved).test(n));
    if (/\$/.test(resolved)) problems.push(`dist/${ref}: variable not derived from package.json`);
    else if (selected.length !== 1 || selected[0] !== windowsZip) problems.push(`dist/${ref} selects [${selected.join(', ')}], not only the Windows package ${windowsZip}`);
  }

  // It must run the shipped script rather than a copy of its logic (an inline copy hides a broken shipped regex).
  const shippedVar = /\$(\w+)\s*=\s*Join-Path\s+\S+\s+['"]Verify-Checksums\.ps1['"]/.exec(script)?.[1];
  const runsShipped = /&\s*['"][^'"\n]*Verify-Checksums\.ps1['"]/.test(script)
    || (shippedVar !== undefined && new RegExp(`&\\s*\\$${shippedVar}\\b`).test(script));
  if (!runsShipped) problems.push('does not run the Verify-Checksums.ps1 from the expanded zip');
  if (/Get-FileHash/.test(script)) problems.push('hashes files itself instead of relying on the shipped script');

  // The shipped script exits 0 whatever it finds, so the step must judge its printed verdict: every SHA256SUMS entry
  // reported OK plus the all-clear, and a changed and a missing file reported as such.
  for (const line of ["Write-Host 'All files match.'", 'Write-Host "OK       $name"', 'Write-Host "MISMATCH $name"', 'Write-Host "MISSING  $name"']) {
    assert.ok(build.includes(line), `scripts/build.mjs Verify-Checksums.ps1 no longer prints ${line}`);
  }
  if (!/['"]OK\s/.test(script)) problems.push('does not count the OK lines');
  if (!script.includes("'All files match.'")) problems.push('does not require the all-clear');
  if (!/['"]MISMATCH \S/.test(script)) problems.push('does not prove a changed file is reported');
  if (!/['"]MISSING {2}\S/.test(script)) problems.push('does not prove a missing file is reported');
  assert.deepEqual(problems, [], `Windows zip check (${step.name}):\n  ${problems.join('\n  ')}`);
});

test('the fixture regeneration gate compares every file the reference generator writes, expected.json included', () => {
  const step = steps(job('.github/workflows/ci.yml', 'differential')).find((s) => /gen_fixtures\.py/.test(s.run ?? ''));
  assert.ok(step, 'the differential job no longer regenerates fixtures');
  const out = /gen_fixtures\.py\s+(\S+)/.exec(step.run)?.[1];
  assert.ok(out, 'no generator output directory');
  const committed = readdirSync(new URL('tests/fixtures/ots/', root)).sort();
  assert.ok(committed.includes('expected.json'));
  const o = escape(out);
  const wholeTree = new RegExp(`\\bdiff\\s+(?:-\\S+\\s+)*-\\w*r\\w*\\s+(?:-\\S+\\s+)*(?:${o}/?\\s+tests/fixtures/ots/?|tests/fixtures/ots/?\\s+${o}/?)(?:\\s|$)`);
  const compared = new Set();
  if (wholeTree.test(step.run)) committed.forEach((f) => compared.add(f));
  for (const [, list, suffix] of step.run.matchAll(new RegExp(`for f in ([^;]+); do cmp ${o}/\\$f(\\S*) tests/fixtures/ots/\\$f\\2(?:\\s|;)`, 'g'))) {
    for (const f of list.trim().split(/\s+/)) compared.add(f + suffix);
  }
  for (const [, f] of step.run.matchAll(new RegExp(`\\bcmp ${o}/([\\w.-]+) tests/fixtures/ots/\\1(?:\\s|;|$)`, 'gm'))) compared.add(f);
  const unchecked = committed.filter((f) => !compared.has(f));
  assert.deepEqual(unchecked, [], `regenerated but never compared against the committed copy: ${unchecked.join(', ')}`);
});
