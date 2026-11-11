// Checks the hostile-input fuzz oracles themselves: the seeds reach both outcomes, and every oracle reports a
// deliberately broken implementation instead of passing it. Inputs are synthetic or committed fixtures only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../..', import.meta.url));
let m;
let seeds;
let dir;
const byLabel = (label) => seeds.find((seed) => seed.label === label)?.bytes ?? assert.fail(`missing seed ${label}`);
const fixtures = () => readdirSync(join(root, 'tests/fixtures/ots')).filter((name) => name.endsWith('.ots')).sort()
  .map((name) => new Uint8Array(readFileSync(join(root, 'tests/fixtures/ots', name))));

before(async () => {
  const bundled = await build({
    stdin: { contents: "export * from './targets-hostile';\nexport { seedCases, TARGETS, runCase } from './campaign-targets';\n", resolveDir: join(root, 'tests/fuzz'), loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, loader: { '.hex': 'text' },
  });
  dir = realpathSync(mkdtempSync(join(tmpdir(), 'unaltered-fuzz-oracles-')));
  const file = join(dir, 'oracles.mjs');
  writeFileSync(file, bundled.outputFiles[0].contents);
  m = await import(pathToFileURL(file).href);
  seeds = await m.seedCases(fixtures());
});
after(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

const outcomes = async (target) => Promise.all(seeds.filter((seed) => seed.target === target).map(async (seed) => [seed.label, await m.runCase(target, seed.bytes)]));

test('campaign entry keeps the six original targets and adds four hostile-input targets', () => {
  assert.deepEqual([...m.TARGETS], ['proof', 'timestamp', 'jpeg', 'png', 'wav', 'mp3', 'qr-frames', 'qr-image', 'trusted-header', 'receipt-store']);
  assert.equal(new Set(seeds.map((seed) => `${seed.target}:${seed.label}`)).size, seeds.length, 'seed labels are unique');
  assert.ok(seeds.every((seed) => seed.bytes.length <= 65536), 'seeds fit the fuzz input bound');
});

test('every new target has seeds that are accepted and seeds that are rejected', async () => {
  for (const target of m.HOSTILE_TARGETS) {
    const results = new Map(await outcomes(target));
    assert.ok([...results.values()].includes('accepted'), `${target} accepted seed`);
    assert.ok([...results.values()].includes('rejected'), `${target} rejected seed`);
  }
  const frames = new Map(await outcomes('qr-frames'));
  for (const label of ['frames-golden-v1', 'frames-golden-at-frame-limit', 'frames-proof-0-reversed', 'frames-proof-0-duplicate', 'frames-uneven-chunks']) assert.equal(frames.get(label), 'accepted', label);
  for (const label of ['frames-golden-over-frame-limit', 'frames-proof-1-missing', 'frames-proof-0-conflict', 'frames-mixed-receipts']) assert.equal(frames.get(label), 'rejected', label);
  const images = new Map(await outcomes('qr-image'));
  for (const label of ['png-740', 'png-at-pixel-limit', 'jpeg-baseline', 'jpeg-progressive-fill-bytes', 'jpeg-tables-and-standalone']) assert.equal(images.get(label), 'accepted', label);
  for (const label of ['png-over-pixel-limit', 'png-over-side-limit', 'png-under-side-limit', 'png-truncated-ihdr', 'jpeg-oversized', 'jpeg-truncated', 'jpeg-frame-after-scan']) assert.equal(images.get(label), 'rejected', label);
  const store = new Map(await outcomes('receipt-store'));
  assert.equal(store.get('store-extra-fields'), 'accepted');
  assert.equal(store.get('store-invalid-json'), 'rejected');
});

test('the frame container reaches beyond the 4096-frame limit and repair yields reassemblable sets', () => {
  assert.equal(m.decodeFrameContainer(byLabel('frames-golden-over-frame-limit')).length, 4097);
  assert.equal(m.decodeFrameContainer(byLabel('frames-golden-at-frame-limit')).length, 4096);
  const broken = byLabel('frames-proof-0-reversed').slice();
  broken[100] ^= 0x55; // inside a payload: checksum no longer matches
  assert.equal(m.referenceRecover(m.decodeFrameContainer(broken)), null);
  assert.notEqual(m.referenceRecover(m.decodeFrameContainer(m.repairFrames(broken, 1))), null);
});

test('frame oracle reports decoders that skip checks, throw untyped errors, mutate input or break re-encoding', async () => {
  // The product passes on every seed (checked above); a reference-backed implementation passes, broken variants must not.
  const recoverOk = async (frames) => {
    const receipt = m.referenceRecover(frames);
    if (!receipt) throw new Error('Invalid archival QR frame: reference');
    return receipt;
  };
  const concatPayloads = async (frames) => {
    const sorted = [...new Map(frames.map((f) => [new DataView(f.buffer, f.byteOffset).getUint32(28), f])).entries()].sort((a, b) => a[0] - b[0]);
    return Uint8Array.from(sorted.flatMap(([, f]) => [...f.subarray(80)]));
  };
  const encodeOk = async (receipt, size) => {
    // Canonical encoder written against the protocol table, using Node's SHA-256.
    const hash = createHash('sha256').update(receipt).digest();
    const id = createHash('sha256').update(Buffer.concat([Buffer.from('UNALTERED-OTS-QR/1\0'), receipt])).digest().subarray(0, 16);
    const cap = size - 80; const total = Math.ceil(receipt.length / cap); const out = [];
    for (let i = 0; i < total; i++) {
      const chunk = receipt.subarray(i * cap, Math.min(receipt.length, (i + 1) * cap));
      const f = new Uint8Array(80 + chunk.length); const v = new DataView(f.buffer);
      f.set(Buffer.from('UOTSQR01')); f[8] = 1; f.set(id, 12); v.setUint32(28, i); v.setUint32(32, total);
      v.setUint32(36, receipt.length); v.setUint32(40, receipt.length); f.set(hash, 44); v.setUint32(76, chunk.length); f.set(chunk, 80); out.push(f);
    }
    return out;
  };
  const good = { recover: recoverOk, encode: encodeOk };
  const tampered = byLabel('frames-proof-0-reversed').slice(); tampered[100] ^= 0x55;
  assert.equal(await m.qrFramesCase(byLabel('frames-proof-0-reversed'), good), 'accepted', 'a correct implementation passes');
  await assert.rejects(m.qrFramesCase(tampered, { recover: concatPayloads, encode: encodeOk }), /accepted a frame set the reference rejects/);
  await assert.rejects(m.qrFramesCase(byLabel('frames-golden-over-frame-limit'), { recover: concatPayloads, encode: encodeOk }), /accepted a frame set the reference rejects/);
  await assert.rejects(m.qrFramesCase(tampered, { recover: async () => { throw new TypeError('x'); }, encode: encodeOk }), /untyped rejection \(TypeError\)/);
  await assert.rejects(m.qrFramesCase(byLabel('frames-golden-v1'), { recover: async () => { throw new Error('Invalid archival QR frame: strict'); }, encode: encodeOk }), /rejected a frame set the reference reassembles/);
  await assert.rejects(m.qrFramesCase(byLabel('frames-golden-v1'), { recover: async (frames) => { const r = await good.recover(frames); frames[0][82] ^= 1; return r; }, encode: encodeOk }), /mutated its input/);
  await assert.rejects(m.qrFramesCase(byLabel('frames-proof-0-reversed'), { recover: good.recover, encode: async (r, size) => (await encodeOk(r, size)).reverse() }), /do not re-encode to the same frames/);
});

test('QR image oracle reports swapped, unbounded or untyped dimension readers', () => {
  const nonSquare = byLabel('jpeg-baseline');
  assert.equal(m.qrImageCase(nonSquare), 'accepted');
  assert.throws(() => m.qrImageCase(nonSquare, (b) => { const d = m.referenceImageDimensions(b); return { width: d.height, height: d.width }; }), /different from the declared header/);
  assert.throws(() => m.qrImageCase(byLabel('png-over-pixel-limit'), () => ({ width: 4000, height: 4001 })), /outside its limits/);
  assert.throws(() => m.qrImageCase(byLabel('png-truncated-ihdr'), () => { throw new RangeError('Offset is outside the bounds of the DataView'); }), /untyped rejection \(RangeError\)/);
  assert.throws(() => m.qrImageCase(byLabel('png-740'), () => { throw new Error('Invalid PNG header'); }), /rejected a header the reference reads/);
  let calls = 0;
  assert.throws(() => m.qrImageCase(byLabel('png-740'), (b) => (++calls > 1 ? { width: 741, height: 740 } : m.referenceImageDimensions(b))), /changed dimensions after appending/);
});

test('trusted-header oracle reports a check that ignores the hash, a false match, aliasing and exceptions', () => {
  const matched = seeds.filter((seed) => seed.target === 'trusted-header').find((seed) => m.trustedHeaderCase(seed.bytes) === 'accepted');
  assert.ok(matched, 'a seed reaches MATCHED_TRUSTED_HEADER');
  const wrongHash = matched.bytes.slice(); wrongHash[0] = (wrongHash[0] & ~3) | 2; // one hash nibble wrong
  assert.equal(m.trustedHeaderCase(wrongHash), 'rejected');
  const fakeHeader = (raw) => ({ raw: Uint8Array.from(raw), hashHex: createHash('sha256').update(createHash('sha256').update(raw).digest()).digest().reverse().toString('hex'), merkleRoot: raw.slice(36, 68), time: new DataView(raw.buffer, raw.byteOffset, 80).getUint32(68, true) });
  const lax = { check: (e) => fakeHeader(e.raw), verify: () => ({ state: 'INVALID_HEADER', trust: 'USER_SUPPLIED_HEADER', detail: 'x' }) };
  assert.throws(() => m.trustedHeaderCase(wrongHash, lax), /accepted a header that does not match/);
  const aliasing = { check: (e) => ({ ...fakeHeader(e.raw), raw: e.raw, merkleRoot: e.raw.subarray(36, 68) }), verify: lax.verify };
  assert.throws(() => m.trustedHeaderCase(matched.bytes, aliasing), /aliases the caller's bytes/);
  const falseMatch = { check: (e) => fakeHeader(e.raw), verify: () => ({ state: 'MATCHED_TRUSTED_HEADER', trust: 'USER_SUPPLIED_HEADER', detail: 'x', bitcoin: { height: 0, hashHex: '', blockTimeUtc: '' } }) };
  assert.throws(() => m.trustedHeaderCase(byLabel('header-0-mode-36').slice(0, 81), falseMatch), /check accepted|specification gives/);
  const throwing = { check: (e) => fakeHeader(e.raw), verify: () => { throw new TypeError('boom'); } };
  assert.throws(() => m.trustedHeaderCase(matched.bytes, throwing), /boom/);
  const untyped = { check: () => { throw new Error('plain'); }, verify: lax.verify };
  assert.throws(() => m.trustedHeaderCase(wrongHash, untyped), /untyped rejection/);
});

test('receipt-store oracle reports kept extra fields, wrong filtering, exceptions and lossy writes', () => {
  const extra = byLabel('store-extra-fields');
  const raw = () => JSON.parse(new TextDecoder().decode(extra));
  const store = () => globalThis.localStorage;
  const passthrough = { load: () => raw(), add: () => true, remove: () => true };
  assert.throws(() => m.receiptStoreCase(extra, passthrough), /holds a field other than digest, time and label/);
  const dropsAll = { load: () => [], add: () => true, remove: () => true };
  assert.throws(() => m.receiptStoreCase(extra, dropsAll), /kept or dropped different records/);
  assert.throws(() => m.receiptStoreCase(byLabel('store-invalid-json'), { load: () => { throw new SyntaxError('bad'); }, add: () => true, remove: () => true }), /bad/);
  const trimmed = (r) => ({ digestHex: r.digestHex, createdAtUtc: r.createdAtUtc, label: r.label });
  const leaky = { load: () => raw().map(trimmed), add: (rec) => { store().setItem('unaltered.receipts.v1', JSON.stringify([{ ...rec, fileName: 'synthetic.pdf' }, ...raw()])); return true; }, remove: () => true };
  assert.throws(() => m.receiptStoreCase(extra, leaky), /written after hostile data holds a field other/);
  assert.equal(globalThis.localStorage, undefined, 'the oracle restores the global it replaced');
});
