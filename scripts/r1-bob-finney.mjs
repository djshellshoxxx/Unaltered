// Opt-in only. No submissions, fixture downloads, proxy, endpoint changes or browser bypasses.
// Capture uses the existing R1 browser runner; reference verification uses the existing Python oracle.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { assessBrowser, assessReference, DIAGNOSTIC_SCOPE, isolateTarget, loadCodec, REFERENCE_VERSION, ROOT, sha256, TARGETS } from './lib/r1-calendars.mjs';

const usage = `Capture (never sufficient for PASS):
  node scripts/r1-bob-finney.mjs <bob|finney> <file> <existing-receipt.ots> [output-dir]
Verify the captured download, offline:
  UNALTERED_PYTHON=/path/to/python node scripts/r1-bob-finney.mjs --reference <packet-dir> <file> <header.hex> <independent-header-source>
See docs/R1_BOB_FINNEY_TEMPLATE.md. Raw --from-json reports are not accepted.`;
const files = Object.freeze({ original: 'original.ots', isolated: 'isolated.ots', report: 'browser.json', downloaded: 'downloaded.ots' });
const JSON_LIMIT = 256 * 1024;
const save = (path, bytes) => writeFile(path, bytes, { mode: 0o600 });
const saveJson = (path, value) => save(path, JSON.stringify(value, null, 2) + '\n');
const parseJson = (text) => { try { return JSON.parse(text); } catch { return null; } };
async function readSmall(path, cap) {
  const info = await stat(path);
  if (!info.isFile() || info.size > cap) throw new Error('Evidence file is not a regular file within its size cap.');
  const bytes = await readFile(path);
  if (bytes.length > cap) throw new Error('Evidence file grew beyond its size cap.');
  return bytes;
}
async function hashFile(path) {
  if (!(await stat(path)).isFile()) throw new Error('Source must be a regular file.');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
const run = (program, args, timeout) => spawnSync(program, args, { cwd: ROOT, encoding: 'utf8', timeout, maxBuffer: JSON_LIMIT, windowsHide: true });

async function capture(args, codec) {
  if (args.length < 3 || args.length > 4 || !Object.hasOwn(TARGETS, args[0])) throw new Error(usage);
  const [target, file, receipt, out] = args;
  const sourceFile = resolve(file);
  const original = await readSmall(resolve(receipt), codec.LIMITS.maxInputBytes);
  const isolated = isolateTarget(original, target, codec);
  const fileSha256 = await hashFile(sourceFile);
  if (Buffer.from(codec.parseProof(isolated).digest).toString('hex') !== fileSha256) throw new Error('The existing receipt does not match the supplied file.');
  // The default is an atomically created private directory, never a predictable shared parent.
  const parent = out === undefined ? tmpdir() : resolve(out);
  if (out !== undefined) await mkdir(parent, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(parent, `unaltered-r1-${target}-`));
  await save(join(directory, files.original), original);
  await save(join(directory, files.isolated), isolated);
  const downloads = join(directory, 'browser-downloads');
  await mkdir(downloads, { mode: 0o700 });
  const runner = join(ROOT, 'scripts/r1-acceptance.mjs');
  // Exactly one target-only run. It retains the real app's CSP, networking and Verify decision.
  const child = run(process.execPath, [runner, sourceFile, join(directory, files.isolated), downloads], 240_000);
  const reportBytes = Buffer.from(child.stdout ?? '');
  await save(join(directory, files.report), reportBytes);
  await save(join(directory, 'browser.stderr.txt'), child.stderr ?? child.error?.code ?? '');
  const report = parseJson(reportBytes.toString('utf8'));
  let downloaded = null;
  if (typeof report?.verify?.upgradedReceiptPath === 'string') {
    const path = await realpath(report.verify.upgradedReceiptPath);
    if (!path.startsWith((await realpath(downloads)) + sep)) throw new Error('Browser download is outside this fresh evidence directory.');
    downloaded = await readSmall(path, codec.LIMITS.maxInputBytes);
    await save(join(directory, files.downloaded), downloaded);
  }
  const browser = assessBrowser({ target, fileSha256, original, isolated, downloaded, report, exitCode: child.status }, codec);
  if (await hashFile(sourceFile) !== fileSha256) {
    browser.browserAccepted = false;
    browser.reasons.push('SOURCE_CHANGED_DURING_BROWSER_RUN');
  }
  const result = assessReference(browser, null);
  const packet = {
    schema: 1, target, checkedAt: new Date().toISOString(), fileSha256,
    browserExitCode: child.status, runnerSha256: sha256(await readFile(runner)),
    hashes: { original: sha256(original), isolated: sha256(isolated), report: sha256(reportBytes), downloaded: downloaded ? sha256(downloaded) : null },
    browser, ...result,
  };
  await saveJson(join(directory, 'packet.json'), packet);
  return { ...result, browserAccepted: browser.browserAccepted, block: browser.block, evidenceDirectory: directory };
}

async function reference(args, codec) {
  if (args.length !== 4) throw new Error(usage);
  const [dir, file, headerPath, headerSource] = args;
  const directory = resolve(dir);
  const packet = parseJson((await readSmall(join(directory, 'packet.json'), JSON_LIMIT)).toString('utf8'));
  if (packet?.schema !== 1 || !Object.hasOwn(TARGETS, packet.target)) throw new Error('A target-isolated capture packet is required. Raw browser reports cannot establish PASS.');
  const bound = {};
  for (const [key, name] of Object.entries(files)) {
    if (key === 'downloaded' && packet.hashes?.[key] === null) { bound[key] = null; continue; }
    const bytes = await readSmall(join(directory, name), key === 'report' ? JSON_LIMIT : codec.LIMITS.maxInputBytes);
    if (sha256(bytes) !== packet.hashes?.[key]) throw new Error(`Captured ${key} evidence does not match its packet binding.`);
    bound[key] = bytes;
  }
  const sourceFile = resolve(file);
  const fileSha256 = await hashFile(sourceFile);
  if (fileSha256 !== packet.fileSha256) throw new Error('Source file differs from the captured browser input.');
  const browser = assessBrowser({
    target: packet.target, fileSha256, original: bound.original, isolated: bound.isolated,
    downloaded: bound.downloaded, report: parseJson(bound.report.toString('utf8')), exitCode: packet.browserExitCode,
  }, codec);
  // A recorded capture failure cannot disappear just because an offline reassessment cannot observe it.
  if (packet.browser?.browserAccepted !== true) {
    browser.browserAccepted = false;
    browser.reasons.push('CAPTURE_NOT_ACCEPTED');
  }
  if (!browser.browserAccepted) return assessReference(browser, null);
  if (!headerSource.trim() || codec.ENDPOINTS.some((e) => e.role === 'explorer' && headerSource.toLowerCase().includes(e.host))) throw new Error('Describe a header source independent of the app explorers (prefer your own node).');
  const headerHex = (await readSmall(resolve(headerPath), 1024)).toString('utf8').trim();
  if (!/^[a-fA-F0-9]{160}$/.test(headerHex)) throw new Error('Supply exactly one 80-byte Bitcoin header as hexadecimal.');
  const header = Buffer.from(headerHex, 'hex');
  const headerHash = createHash('sha256').update(createHash('sha256').update(header).digest()).digest().reverse().toString('hex');
  const python = process.env.UNALTERED_PYTHON || 'python3';
  const probe = run(python, ['-c', 'import importlib.metadata; print(importlib.metadata.version("opentimestamps"))'], 10_000);
  if (probe.status !== 0 || probe.stdout.trim() !== REFERENCE_VERSION) throw new Error(`The existing reference environment with opentimestamps==${REFERENCE_VERSION} is required; this diagnostic installs nothing.`);
  const output = await mkdtemp(join(directory, 'reference-'));
  // Give the oracle our verified bytes, not a path taken from a report or a possibly different receipt.
  const receiptPath = join(output, files.downloaded);
  await save(receiptPath, bound.downloaded);
  await save(join(output, 'header.hex'), headerHex.toLowerCase() + '\n');
  const oracle = join(ROOT, 'tests/differential/verify_reference.py');
  const child = run(python, [oracle, sourceFile, receiptPath, headerHex], 30_000);
  await save(join(output, 'reference.json'), child.stdout ?? '');
  await save(join(output, 'reference.stderr.txt'), child.stderr ?? child.error?.code ?? '');
  const independent = {
    version: probe.stdout.trim(), fileSha256: await hashFile(sourceFile),
    receiptSha256: sha256(await readSmall(receiptPath, codec.LIMITS.maxInputBytes)),
    headerHash, headerSource, exitCode: child.status, report: parseJson(child.stdout),
  };
  const result = assessReference(browser, independent);
  await saveJson(join(output, 'result.json'), {
    ...result, checkedAt: new Date().toISOString(), reference: independent,
    packetSha256: sha256(await readSmall(join(directory, 'packet.json'), JSON_LIMIT)),
    oracleSha256: sha256(await readFile(oracle)), headerSha256: sha256(header),
    note: 'Header provenance is supplied by the operator. This does not independently establish chain membership or attest that reports were not edited.',
  });
  return { ...result, evidenceDirectory: output };
}

try {
  const args = process.argv.slice(2);
  if (args[0] === '--help') { console.log(usage); }
  else {
    if (args[0] === '--from-json') throw new Error('BLOCKED: raw saved reports cannot attribute target confirmation or bind independent verification.\n' + usage);
    const codec = await loadCodec();
    const result = args[0] === '--reference' ? await reference(args.slice(1), codec) : await capture(args, codec);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'PASS' ? 0 : 2;
  }
} catch (error) {
  console.error(JSON.stringify({ ...DIAGNOSTIC_SCOPE, status: 'BLOCKED', reason: error.message }));
  process.exitCode = 2;
}
