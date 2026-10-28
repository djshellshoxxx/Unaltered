// REL-2 / SPEC12: bounded, seeded V8 block-feedback fuzzing, using installed dev dependencies only.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createExecutor } from './lib/fuzz-executor.mjs';

const usage = 'node scripts/parser-fuzz.mjs [--iterations 100000] [--seconds 300] [--seed 20261028] [--out scratch/fuzz] [--replay finding.json]';
const options = { iterations: 100000, seconds: 300, seed: 20261028, out: 'scratch/fuzz' };
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, '');
  if (key === 'help') { process.stdout.write(`${usage}\n`); process.exit(0); }
  if (!['iterations', 'seconds', 'seed', 'out', 'replay'].includes(key) || process.argv[i] !== `--${key}` || !process.argv[i + 1]) throw new Error(usage);
  const value = process.argv[++i];
  options[key] = ['iterations', 'seconds', 'seed'].includes(key) ? Number(value) : value;
}
for (const [key, max] of [['iterations', 10000000], ['seconds', 86400], ['seed', 0xffffffff]]) {
  if (!Number.isSafeInteger(options[key]) || options[key] < 1 || options[key] > max) throw new Error(`Invalid ${key}`);
}
const MAX_BYTES = 65536;
const MAX_CORPUS = 256;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
let randomState = options.seed >>> 0;
const random = (n) => {
  randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5;
  return (randomState >>> 0) % n;
};
function mutate(source, target, crc32) {
  let bytes = source.slice();
  for (let changes = 1 + random(4); changes > 0; changes--) {
    const at = random(bytes.length + 1);
    switch (random(5)) {
      case 0: if (bytes.length) bytes[random(bytes.length)] ^= 1 << random(8); break;
      case 1: if (bytes.length) bytes[random(bytes.length)] = random(256); break;
      case 2: bytes = bytes.slice(0, at); break;
      case 3: {
        const count = Math.min(1 + random(32), MAX_BYTES - bytes.length);
        const next = new Uint8Array(bytes.length + count);
        next.set(bytes.subarray(0, at));
        for (let j = 0; j < count; j++) next[at + j] = random(256);
        next.set(bytes.subarray(at), at + count); bytes = next; break;
      }
      case 4: bytes = Uint8Array.from([...bytes.subarray(0, at), ...bytes.subarray(Math.min(bytes.length, at + 1 + random(32)))]); break;
    }
  }
  // Half the PNG mutations repair surviving chunk CRCs, so feedback can reach past integrity rejection.
  if (target === 'png' && random(2) && bytes.length >= 8) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let at = 8; at + 12 <= bytes.length;) {
      const size = view.getUint32(at);
      if (size > bytes.length - at - 12) break;
      view.setUint32(at + 8 + size, crc32(bytes.subarray(at + 4, at + 8 + size)));
      at += 12 + size;
    }
  }
  return bytes;
}

const temp = mkdtempSync(join(tmpdir(), 'unaltered-fuzz-'));
let executor;
try {
  const bundled = await build({ entryPoints: ['tests/fuzz/targets.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false });
  const bundle = bundled.outputFiles[0].contents;
  const targetFile = join(temp, 'targets.mjs');
  writeFileSync(targetFile, bundle);
  const targetUrl = pathToFileURL(targetFile).href;
  const { TARGETS, seedCases, crc32 } = await import(targetUrl);
  executor = await createExecutor(targetUrl);
  const start = performance.now();
  const proofs = readdirSync('tests/fixtures/ots').filter((name) => name.endsWith('.ots')).sort().map((name) => {
    const path = join('tests/fixtures/ots', name);
    if (statSync(path).size > MAX_BYTES) throw new Error('Seed exceeds fuzz input bound');
    return new Uint8Array(readFileSync(path));
  });
  const seeds = seedCases(proofs);
  mkdirSync(options.out, { recursive: true });
  const output = mkdtempSync(join(resolve(options.out), 'campaign-'));
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const report = { sourceCommit, targetSha256: sha256(bundle), node: process.version, v8: process.versions.v8,
    options, limits: { maxInputBytes: MAX_BYTES, maxCorpusPerTarget: MAX_CORPUS, caseDeadlineMs: 1000, workerOldHeapMiB: 128 },
    status: 'running', executed: 0, mutations: 0, targets: Object.fromEntries(TARGETS.map((t) => [t, { accepted: 0, rejected: 0, ranges: 0, corpus: 0 }])), output };
  const corpus = new Map(TARGETS.map((t) => [t, []]));
  const hashes = new Set();
  let current;
  const save = () => { report.elapsedMs = Math.round(performance.now() - start); writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); };
  const retain = (item, initial = false) => {
    const key = `${item.target}-${sha256(item.bytes)}`;
    const list = corpus.get(item.target);
    if (hashes.has(key) || list.length >= MAX_CORPUS) return;
    hashes.add(key); list.push(item);
    writeFileSync(join(output, `${key}.bin`), item.bytes, { flag: 'wx' });
    report.targets[item.target].corpus = list.length;
    if (initial) report.retainedSeeds = (report.retainedSeeds ?? 0) + 1;
  };
  const evaluate = async (item) => {
    current = item;
    if (!TARGETS.includes(item.target) || item.bytes.length > MAX_BYTES) throw new Error('Invalid target or oversized fuzz input');
    const result = await executor.runCase(item.target, item.bytes);
    report.executed++;
    if (result.finding) throw Object.assign(new Error(result.finding.message), { finding: result.finding });
    const counts = report.targets[item.target];
    counts[result.outcome]++; counts.ranges = result.ranges;
    if (result.novel) retain(item);
  };
  try {
    if (options.replay) {
      if (statSync(options.replay).size > MAX_BYTES) throw new Error('Replay manifest too large');
      const saved = JSON.parse(readFileSync(options.replay, 'utf8'));
      if (!TARGETS.includes(saved.target)) throw new Error('Invalid replay target');
      if (typeof saved.input !== 'string' || basename(saved.input) !== saved.input) throw new Error('Invalid replay file name');
      const inputPath = resolve(dirname(options.replay), saved.input);
      const info = statSync(inputPath);
      if (!info.isFile() || info.size > MAX_BYTES) throw new Error('Replay input too large or not a file');
      const bytes = new Uint8Array(readFileSync(inputPath));
      if (bytes.length > MAX_BYTES || sha256(bytes) !== saved.sha256) throw new Error('Replay input size/digest mismatch');
      await evaluate({ target: saved.target, bytes });
      report.status = 'replay-passed';
    } else {
      report.seedExecutions = seeds.length;
      for (const item of seeds) { retain(item, true); await evaluate(item); }
      while (report.mutations < options.iterations && performance.now() - start < options.seconds * 1000) {
        const target = TARGETS[report.mutations % TARGETS.length];
        const list = corpus.get(target);
        await evaluate({ target, bytes: mutate(list[random(list.length)].bytes, target, crc32) });
        report.mutations++;
        if (report.mutations % 1000 === 0) save();
      }
      report.status = 'budget-complete';
      report.stopReason = report.mutations === options.iterations ? 'iterations' : 'wall-clock';
    }
  } catch (error) {
    report.status = 'finding';
    report.finding = error.finding ?? { kind: error.code === 'FUZZ_TIMEOUT' ? 'timeout' : 'worker-or-harness', name: error.name, message: error.message };
    if (current) {
      writeFileSync(join(output, 'finding.bin'), current.bytes, { flag: 'wx' });
      const finding = { target: current.target, input: 'finding.bin', sha256: sha256(current.bytes), seed: options.seed, iteration: report.mutations, ...report.finding };
      writeFileSync(join(output, 'finding.json'), JSON.stringify(finding, null, 2) + '\n', { flag: 'wx' });
    }
    process.exitCode = 1;
  } finally { save(); }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} finally {
  if (executor) await executor.close();
  rmSync(temp, { recursive: true, force: true });
}
