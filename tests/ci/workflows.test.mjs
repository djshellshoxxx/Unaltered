// Static regressions for what the required CI gates actually check. Offline, no YAML dependency: the readers below
// understand only the layout this repository's workflows use, and fail closed when a job or step is not found.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n');
const version = JSON.parse(read('package.json')).version;
const workflows = readdirSync(new URL('.github/workflows/', root)).filter((f) => /\.ya?ml$/.test(f)).map((f) => `.github/workflows/${f}`);

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
      } else {
        // A plain scalar cannot contain ": " (YAML reads a nested mapping and rejects the file); quote it or use `|`.
        assert.ok(/^["'[{|>]/.test(value) || !/:(?:\s|$)/.test(value.replace(/\s+#.*$/, '')), `not valid YAML, quote it or use a block: ${lines[i].trim()}`);
        step[m[1]] = value.replace(/^"(.*)"$/, '$1');
      }
    }
    return step;
  });
}

const allSteps = () => workflows.flatMap((wf) => {
  const lines = read(wf).split('\n');
  const jobNames = lines.slice(lines.indexOf('jobs:') + 1).map((l) => /^ {2}([\w-]+):$/.exec(l)?.[1]).filter(Boolean);
  assert.ok(lines.includes('jobs:') && jobNames.length > 0, `${wf}: no jobs found`);
  return jobNames.flatMap((name) => steps(job(wf, name)).map((s) => ({ ...s, where: `${wf} job ${name}` })));
});

/** Case-insensitive PowerShell-style wildcard (`*`, `?`) as an anchored RegExp. */
const wildcard = (pattern) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('the Windows job checks the Windows zip itself, with the Verify-Checksums.ps1 it ships', () => {
  const build = read('scripts/build.mjs');
  // Package names are written either inline ([`${prefix}.zip`, makeZip(prefixed(windowsFiles))]) or through the
  // `archive` map (const archive = { windows: `${prefix}.zip`, ... }; [archive.windows, makeZip(...)]).
  const archiveMap = Object.fromEntries([...(/const archive = \{(.*)\};$/m.exec(build)?.[1] ?? '').matchAll(/(\w+):\s*`\$\{prefix\}([^`]*)`/g)].map(([, key, suffix]) => [key, suffix]));
  const packages = [
    ...[...build.matchAll(/\[`\$\{prefix\}([^`]*)`,\s*make\w+\(prefixed\((\w+)\)\)\]/g)].map(([, suffix, files]) => ({ suffix, files })),
    ...[...build.matchAll(/\[archive\.(\w+),\s*make\w+\(prefixed\((\w+)\)\)\]/g)].map(([, key, files]) => ({ suffix: archiveMap[key], files })),
  ].filter((p) => p.suffix !== undefined).map(({ suffix, files }) => ({ name: `unaltered-${version}${suffix}`, files }));
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
  for (const line of ['Write-Host "OK       $name"', 'Write-Host "MISMATCH $name"', 'Write-Host "MISSING  $name"']) {
    assert.ok(build.includes(line), `scripts/build.mjs Verify-Checksums.ps1 no longer prints ${line}`);
  }
  // The all-clear is whatever the shipped script prints first after a clean pass; the step must require that exact text.
  const clear = /if \(\$bad -eq 0\) \{\s*Write-Host (?:"(All files match[^"]*)"|'(All files match[^']*)')/.exec(build);
  const allClear = clear?.[1] ?? clear?.[2];
  assert.ok(allClear, 'scripts/build.mjs Verify-Checksums.ps1 no longer prints an all-clear line');
  if (!/['"]OK\s/.test(script)) problems.push('does not count the OK lines');
  // Required on the clean pass: the step must fail when the all-clear is absent (`-notcontains`), not merely mention it.
  if (!script.includes(`-notcontains "${allClear}"`) && !script.includes(`-notcontains '${allClear}'`)) problems.push(`does not require the all-clear "${allClear}"`);
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

test('no Playwright gate lets a passing retry hide a failed attempt', () => {
  // GitHub-hosted runners always set CI=true, and the config retries whenever CI is set.
  const retries = /\bretries:\s*([^,\n]+)/.exec(read('playwright.config.ts'))?.[1]?.trim();
  assert.ok(retries, 'playwright.config.ts has no retries setting');
  if (retries === '0') return;
  const e2eScript = JSON.parse(read('package.json')).scripts['test:e2e'];
  assert.match(e2eScript, /\bplaywright test$/, 'npm run test:e2e must end in `playwright test` so appended flags reach it');
  const strict = /(?:^|\s)(?:--retries[= ]0|--fail-on-flaky-tests)(?=\s|$)/;
  const invocations = [];
  for (const s of allSteps()) {
    for (const line of (s.run ?? '').split('\n')) {
      for (const cmd of line.split(/&&|;/)) {
        if (/\bnpm run test:e2e\b/.test(cmd)) invocations.push({ where: s.where, cmd, args: cmd.split(/\s--\s/).slice(1).join(' -- ') });
        else if (/\b(?:playwright|cli\.js)\s+test\b/.test(cmd)) invocations.push({ where: s.where, cmd, args: cmd });
      }
    }
  }
  assert.ok(invocations.length >= 3, 'expected the e2e, Windows and memory Playwright gates');
  const lenient = invocations.filter((i) => !strict.test(i.args)).map((i) => `${i.where}: ${i.cmd.trim()}`);
  assert.deepEqual(lenient, [], `Playwright runs that retry (config: retries ${retries}) without --retries=0 or --fail-on-flaky-tests`);
});

test('the Python reference oracle is installed only from a hash-pinned requirements file', () => {
  const sources = [...workflows, ...readdirSync(new URL('scripts/', root)).filter((f) => f.endsWith('.sh')).map((f) => `scripts/${f}`)];
  const installs = sources.flatMap((file) => read(file).split('\n')
    .flatMap((line) => line.split(/&&|;/))
    .filter((cmd) => /\bpip["']?\s+install\b/.test(cmd))
    .map((cmd) => ({ file, cmd: cmd.trim() })));
  assert.ok(installs.length >= 2, 'expected the differential job and the R1 script to install the reference client');
  const problems = [];
  const files = new Set();
  for (const { file, cmd } of installs) {
    if (!/(?:^|\s)--require-hashes(?=\s|$)/.test(cmd)) problems.push(`${file}: ${cmd}: no --require-hashes`);
    if (!/(?:^|\s)--only-binary[= ]:all:(?=\s|$)/.test(cmd)) problems.push(`${file}: ${cmd}: may build an sdist with unpinned build dependencies`);
    const req = /(?:^|\s)(?:-r|--requirement)[= ]["']?([^\s"']+)/.exec(cmd)?.[1];
    if (req && existsSync(new URL(req, root))) files.add(req);
    else problems.push(`${file}: ${cmd}: names no committed requirements file`);
  }
  assert.deepEqual(problems, [], 'unpinned reference installs');
  const reviewed = read('docs/DEPENDENCIES.md').split('\n').filter((l) => l.startsWith('|'));
  for (const req of files) {
    const logical = read(req).replace(/\\\n/g, ' ').split('\n').map((l) => l.replace(/(?:^|\s)#.*$/, '').trim()).filter(Boolean);
    const pins = logical.map((l) => {
      const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)==([A-Za-z0-9.]+)((?:\s+--hash=sha256:[0-9a-f]{64})+)$/.exec(l);
      assert.ok(m, `${req}: not an exact, hash-pinned requirement: ${l}`);
      return { name: m[1], version: m[2] };
    });
    assert.ok(pins.some((p) => p.name === 'opentimestamps' && p.version === '0.4.5'), `${req} does not pin opentimestamps==0.4.5`);
    for (const { name, version: v } of pins) {
      assert.ok(reviewed.some((l) => l.includes(name) && l.includes(v) && l.includes(req)), `docs/DEPENDENCIES.md records no review of ${name}==${v} as pinned in ${req}`);
    }
  }
});
