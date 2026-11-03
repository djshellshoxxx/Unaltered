// Offline policy/fixture tests only: these synthetic trees do not establish live Bob/Finney compatibility.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assessBrowser, assessReference, isolateTarget, loadCodec, ROOT, sha256, TARGETS } from '../../scripts/lib/r1-calendars.mjs';

const codec = await loadCodec();
const file = Buffer.from('Synthetic diagnostic policy fixture. Not a real anchored receipt.');
const digest = Buffer.from(sha256(file), 'hex');
const height = 428648;
const pending = (name) => ({ kind: 'pending', uri: `https://${TARGETS[name]}` });
const alice = { kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' };
const proof = (attestations, children = [], fingerprint = digest) => codec.serializeProof({
  digest: fingerprint, root: { msg: fingerprint, attestations, children },
});
const original = proof([pending('bob'), pending('finney'), alice, { kind: 'bitcoin', height }]);
const isolated = isolateTarget(original, 'bob', codec);
const downloaded = proof([{ kind: 'bitcoin', height }]);
const request = (name) => ({ kind: 'upgrade', host: TARGETS[name], method: 'GET', status: 200, acao: '*', failure: null });
const report = () => ({
  classification: 'PASS',
  upgrade: { confirmed: true, downloaded: true, stillPending: false, receiptError: null, failedCalendars: [], unknownCalendars: null },
  verify: { state: 'VERIFIED', block: String(height), upgradedReceiptPath: '/synthetic/fresh/download.ots' },
  csp: [], requests: [request('bob')],
});
const evidence = () => ({ target: 'bob', fileSha256: sha256(file), original, isolated, downloaded, report: report(), exitCode: 0 });
const inspect = (value = evidence()) => assessBrowser(value, codec);
const independent = (browser) => ({
  version: '0.4.5', fileSha256: browser.fileSha256, receiptSha256: browser.receiptSha256,
  headerHash: '8'.repeat(64), headerSource: 'own-node (synthetic policy control only)', exitCode: 0,
  report: { ok: true, digestMatches: true, headerHash: '8'.repeat(64), bitcoin: [{ height, verifiedTime: 1473227803 }] },
});
function assertFullGateBlocked(result) {
  assert.equal(result.scope, 'automated-target-proof-and-reference-checks');
  assert.equal(result.fullR1Acceptance, 'BLOCKED');
  assert.deepEqual(result.remainingManualChecks, ['APP_DISPLAYED_TIME_COMPARISON', 'INDEPENDENT_HEADER_PROVENANCE']);
}

test('isolation keeps only existing selected pending attestations and their operation paths', () => {
  const childDigest = Buffer.from(sha256(digest), 'hex');
  const source = proof([pending('bob'), pending('finney'), { kind: 'bitcoin', height }], [{
    op: { kind: 'sha256' }, node: { msg: childDigest, attestations: [pending('bob'), alice, { kind: 'bitcoin', height }], children: [] },
  }]);
  const result = codec.parseProof(isolateTarget(source, 'bob', codec));
  assert.deepEqual(result.digest, new Uint8Array(digest));
  const atts = codec.collectAttestations(result.root);
  assert.equal(atts.length, 2);
  assert.ok(atts.every(({ attestation }) => attestation.kind === 'pending' && attestation.uri === `https://${TARGETS.bob}`));
  assert.deepEqual(result.root.children[0].node.msg, new Uint8Array(childDigest));
  assert.ok(codec.collectAttestations(codec.parseProof(source).root).some(({ attestation }) => attestation.kind === 'bitcoin'));
});

test('Finney is isolated separately; a URI-looking operation argument is not a pending attestation', () => {
  const finney = codec.parseProof(isolateTarget(original, 'finney', codec));
  assert.deepEqual(codec.collectAttestations(finney.root).map(({ attestation }) => attestation), [pending('finney')]);
  const arg = Buffer.from(`https://${TARGETS.bob}`);
  const misleading = proof([alice], [{
    op: { kind: 'append', arg }, node: { msg: Buffer.concat([digest, arg]), attestations: [alice], children: [] },
  }]);
  assert.ok(Buffer.from(misleading).includes(arg));
  assert.throws(() => isolateTarget(misleading, 'bob', codec), /no existing pending attestation/);
});

test('unsupported, malformed, oversized and missing-target receipts fail closed', async () => {
  assert.throws(() => isolateTarget(Buffer.from(`https://${TARGETS.bob}`), 'bob', codec));
  assert.throws(() => isolateTarget(new Uint8Array(codec.LIMITS.maxInputBytes + 1), 'bob', codec));
  assert.throws(() => isolateTarget(proof([alice]), 'bob', codec), /no existing pending attestation/);
  assert.throws(() => isolateTarget(original, 'alice', codec), /Select bob or finney/);
  const unsupported = await readFile(join(ROOT, 'tests/fixtures/ots/litecoin.ots'));
  assert.throws(() => isolateTarget(unsupported, 'bob', codec), (error) => error.code === 'PROOF_UNSUPPORTED');
});

test('a clean synthetic browser envelope remains BLOCKED without the independent reference', () => {
  const browser = inspect();
  assert.equal(browser.browserAccepted, true);
  const result = assessReference(browser, null);
  assert.equal(result.status, 'BLOCKED');
  assert.deepEqual(result.reasons, ['INDEPENDENT_REFERENCE_REQUIRED']);
  assertFullGateBlocked(result);
});

for (const [name, change, reason] of [
  ['malformed Bob 200 rejected while Alice makes the global run PASS', (e) => {
    e.report.requests.push({ ...request('bob'), host: 'alice.btc.calendar.opentimestamps.org' });
    e.report.upgrade.failedCalendars.push('Bob: invalid receipt');
    e.report.upgrade.receiptError = 'The calendar returned an invalid receipt.';
  }, 'UPGRADE_NOT_CLEAN'],
  ['Bob 200 remains pending while Alice makes the global run PASS', (e) => {
    e.report.requests.push({ ...request('bob'), host: 'alice.btc.calendar.opentimestamps.org' });
    e.report.upgrade.stillPending = true;
  }, 'OTHER_CALENDAR_REQUESTED'],
  ['readable 200 downloads only pending attestations', (e) => { e.downloaded = isolated; }, 'TARGET_BITCOIN_PROOF_MISSING'],
  ['readable 200 downloads malformed bytes', (e) => { e.downloaded = Buffer.from('not an ots receipt'); }, 'DOWNLOADED_RECEIPT_INVALID'],
  ['global PASS without a downloaded receipt', (e) => { e.downloaded = null; }, 'DOWNLOADED_RECEIPT_MISSING'],
  ['pre-existing Bitcoin proof is left in the browser input', (e) => { e.isolated = original; }, 'TARGET_ISOLATION_MISMATCH'],
  ['Bob receives no request', (e) => { e.report.requests = []; }, 'TARGET_NOT_REQUESTED'],
  ['only Finney is queried', (e) => { e.report.requests = [request('finney')]; }, 'OTHER_CALENDAR_REQUESTED'],
  ['target CORS read fails', (e) => { e.report.requests[0].failure = 'net::ERR_FAILED'; }, 'TARGET_READ_NOT_CLEAN'],
  ['target 200 lacks ACAO', (e) => { e.report.requests[0].acao = null; }, 'TARGET_READ_NOT_CLEAN'],
  ['target request is a POST', (e) => { e.report.requests[0].method = 'POST'; }, 'UNEXPECTED_NETWORK_REQUEST'],
  ['unexpected endpoint is contacted', (e) => { e.report.requests.push({ kind: 'explorer', host: 'example.invalid', method: 'GET' }); }, 'UNEXPECTED_NETWORK_REQUEST'],
  ['CSP violation is present', (e) => { e.report.csp.push('connect-src'); }, 'CSP_EVIDENCE_NOT_CLEAN'],
  ['input file digest differs', (e) => { e.fileSha256 = '0'.repeat(64); }, 'INPUT_FILE_DIGEST_MISMATCH'],
  ['download belongs to another file', (e) => { e.downloaded = proof([{ kind: 'bitcoin', height }], [], Buffer.alloc(32)); }, 'OUTPUT_FILE_DIGEST_MISMATCH'],
  ['download contains another Bitcoin height', (e) => { e.downloaded = proof([{ kind: 'bitcoin', height: height + 1 }]); }, 'TARGET_BITCOIN_PROOF_MISSING'],
  ['browser process failed despite a PASS-looking report', (e) => { e.exitCode = 1; }, 'BROWSER_NOT_VERIFIED'],
  ['browser never verified the proof', (e) => { e.report.verify.state = 'INVALID_PROOF'; }, 'BROWSER_NOT_VERIFIED'],
  ['browser lacks confirmation/download evidence', (e) => { e.report.upgrade.confirmed = false; }, 'BROWSER_DOWNLOAD_NOT_CONFIRMED'],
  ['verified block height is absent', (e) => { e.report.verify.block = null; }, 'VERIFIED_BLOCK_MISSING'],
]) {
  test(name, () => {
    const value = evidence();
    change(value);
    const browser = inspect(value);
    assert.equal(browser.browserAccepted, false);
    assert.ok(browser.reasons.includes(reason), browser.reasons.join(', '));
    assert.equal(assessReference(browser, independent(browser)).status, 'BLOCKED');
  });
}

test('a complete synthetic envelope can PASS automated checks while full R1 remains BLOCKED', () => {
  const browser = inspect();
  const result = assessReference(browser, independent(browser));
  assert.equal(result.status, 'PASS');
  assert.equal(result.target, 'bob');
  assert.deepEqual(result.reasons, []);
  assertFullGateBlocked(result);
});

for (const [name, change, reason] of [
  ['reference used another receipt', (r) => { r.receiptSha256 = '0'.repeat(64); }, 'REFERENCE_INPUT_BINDING_MISMATCH'],
  ['reference used another file', (r) => { r.fileSha256 = '0'.repeat(64); }, 'REFERENCE_INPUT_BINDING_MISMATCH'],
  ['reference version differs from the accepted pin', (r) => { r.version = '0.4.4'; }, 'REFERENCE_VERSION_MISMATCH'],
  ['reference exited unsuccessfully', (r) => { r.exitCode = 1; }, 'REFERENCE_NOT_VERIFIED'],
  ['reference found the wrong file digest', (r) => { r.report.digestMatches = false; }, 'REFERENCE_NOT_VERIFIED'],
  ['reference rejected the proof', (r) => { r.report.ok = false; }, 'REFERENCE_NOT_VERIFIED'],
  ['reference verified another block', (r) => { r.report.bitcoin[0].height++; }, 'REFERENCE_BLOCK_NOT_VERIFIED'],
  ['reference returned a verification error', (r) => { r.report.bitcoin[0].error = 'VerificationError'; }, 'REFERENCE_BLOCK_NOT_VERIFIED'],
  ['reference returned no verified time', (r) => { delete r.report.bitcoin[0].verifiedTime; }, 'REFERENCE_BLOCK_NOT_VERIFIED'],
  ['reference used another header', (r) => { r.report.headerHash = '7'.repeat(64); }, 'REFERENCE_HEADER_MISMATCH'],
  ['header source was not recorded', (r) => { r.headerSource = ''; }, 'INDEPENDENT_HEADER_SOURCE_REQUIRED'],
]) {
  test(name, () => {
    const browser = inspect();
    const ref = independent(browser);
    change(ref);
    const result = assessReference(browser, ref);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reasons.includes(reason), result.reasons.join(', '));
  });
}

const cli = (args, env = {}) => spawnSync(process.execPath, [join(ROOT, 'scripts/r1-bob-finney.mjs'), ...args], {
  cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 10_000, maxBuffer: 256 * 1024,
});
test('old --from-json shortcut is rejected before any browser/reference run', () => {
  const child = cli(['--from-json', '/nonexistent/raw-report.json', '/nonexistent/receipt.ots']);
  assert.equal(child.status, 2, child.stderr);
  assert.match(child.stderr, /raw saved reports cannot attribute/);
  assertFullGateBlocked(JSON.parse(child.stderr));
});

test('CLI refuses a missing target before creating any browser evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'unaltered-r1-preflight-test-'));
  try {
    await writeFile(join(dir, 'file.bin'), file);
    await writeFile(join(dir, 'alice-only.ots'), proof([alice]));
    const child = cli(['bob', join(dir, 'file.bin'), join(dir, 'alice-only.ots'), join(dir, 'out')]);
    assert.equal(child.status, 2, child.stderr);
    assert.match(child.stderr, /no existing pending attestation/);
    assertFullGateBlocked(JSON.parse(child.stderr));
    await assert.rejects(stat(join(dir, 'out')), (error) => error.code === 'ENOENT');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('CLI rejects packet/receipt substitution and cannot PASS without the reference runtime', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'unaltered-r1-policy-test-'));
  try {
    const reportBytes = Buffer.from(JSON.stringify(report()));
    await writeFile(join(dir, 'file.bin'), file);
    await writeFile(join(dir, 'header.hex'), '00'.repeat(80));
    await writeFile(join(dir, 'original.ots'), original);
    await writeFile(join(dir, 'isolated.ots'), isolated);
    await writeFile(join(dir, 'browser.json'), reportBytes);
    await writeFile(join(dir, 'downloaded.ots'), downloaded);
    const packet = {
      schema: 1, target: 'bob', fileSha256: sha256(file), browserExitCode: 0,
      hashes: { original: sha256(original), isolated: sha256(isolated), report: sha256(reportBytes), downloaded: sha256(downloaded) },
      browser: inspect(),
    };
    await writeFile(join(dir, 'packet.json'), JSON.stringify(packet));
    const args = ['--reference', dir, join(dir, 'file.bin'), join(dir, 'header.hex'), 'own-node (synthetic test)'];
    packet.browser.browserAccepted = false;
    packet.browser.reasons.push('SOURCE_CHANGED_DURING_BROWSER_RUN');
    await writeFile(join(dir, 'packet.json'), JSON.stringify(packet));
    const failedCapture = cli(args);
    assert.equal(failedCapture.status, 2, failedCapture.stderr);
    assert.ok(JSON.parse(failedCapture.stdout).reasons.includes('CAPTURE_NOT_ACCEPTED'));
    assertFullGateBlocked(JSON.parse(failedCapture.stdout));
    packet.browser = inspect();
    await writeFile(join(dir, 'packet.json'), JSON.stringify(packet));
    const missingRuntime = cli(args, { UNALTERED_PYTHON: join(dir, 'missing-python') });
    assert.equal(missingRuntime.status, 2, missingRuntime.stderr);
    assert.match(missingRuntime.stderr, /opentimestamps==0.4.5 is required/);
    await writeFile(join(dir, 'downloaded.ots'), isolated);
    const substituted = cli(args);
    assert.equal(substituted.status, 2, substituted.stderr);
    assert.match(substituted.stderr, /downloaded evidence does not match its packet binding/);
    assert.equal(sha256(await readFile(join(dir, 'original.ots'))), sha256(original));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
