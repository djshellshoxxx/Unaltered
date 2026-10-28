/** Deterministic parser entrypoints and seed corpus for the optional fuzz driver. */
import { equalBytes, toHex } from '../../src/core/bytes';
import { UnalteredError } from '../../src/core/errors';
import * as codec from '../../src/core/ots/codec';
import { cleanMp3, cleanWav, selfCheckAudio } from '../../src/core/strip/audio';
import { cleanJpeg, selfCheckJpeg } from '../../src/core/strip/jpeg';
import { cleanPng, selfCheckPng } from '../../src/core/strip/png';
export { crc32 } from '../../src/core/strip/png';
import { makeMp3, makeWav } from '../helpers/audio';
import { makeJpeg, makePng } from '../helpers/images';

export type Target = 'proof' | 'timestamp' | 'jpeg' | 'png' | 'wav' | 'mp3';
type CleanerTarget = Exclude<Target, 'proof' | 'timestamp'>;
export type CaseResult = 'accepted' | 'rejected';

const ZERO_DIGEST = new Uint8Array(32);
const copy = (bytes: Uint8Array): Uint8Array => bytes.slice();

function commitments(root: Parameters<typeof codec.collectAttestations>[0]): string[] {
  return codec.collectAttestations(root)
    .map(({ node, attestation }) => `${toHex(node.msg)}:${attestation.kind === 'bitcoin' ? `bitcoin:${attestation.height}` : `pending:${attestation.uri}`}`)
    .sort();
}

function parseCase(target: 'proof' | 'timestamp', bytes: Uint8Array): CaseResult {
  let parsed: ReturnType<typeof codec.parseProof> | ReturnType<typeof codec.parseTimestampBody>;
  try {
    parsed = target === 'proof' ? codec.parseProof(bytes) : codec.parseTimestampBody(bytes, ZERO_DIGEST);
  } catch (error) {
    if (error instanceof UnalteredError) return 'rejected';
    throw error;
  }

  // Everything after initial parsing is an oracle. Failures here must escape the
  // rejection catch so a broken serializer or unstable parse cannot be fuzzed away.
  if (target === 'proof') {
    const proof = parsed as ReturnType<typeof codec.parseProof>;
    const canonical = codec.serializeProof(proof);
    const reparsed = codec.parseProof(canonical);
    if (!equalBytes(reparsed.digest, proof.digest)) throw new Error('Proof round-trip changed the digest.');
    if (toHex(codec.serializeProof(reparsed)) !== toHex(canonical)) throw new Error('Proof canonical serialization is unstable.');
    if (JSON.stringify(commitments(reparsed.root)) !== JSON.stringify(commitments(proof.root))) {
      throw new Error('Proof round-trip changed an attestation commitment.');
    }
  } else {
    const tree = parsed as ReturnType<typeof codec.parseTimestampBody>;
    const canonical = codec.serializeTree(tree);
    const reparsed = codec.parseTimestampBody(canonical, ZERO_DIGEST);
    if (toHex(codec.serializeTree(reparsed)) !== toHex(canonical)) throw new Error('Timestamp canonical serialization is unstable.');
    if (JSON.stringify(commitments(reparsed)) !== JSON.stringify(commitments(tree))) {
      throw new Error('Timestamp round-trip changed an attestation commitment.');
    }
  }
  return 'accepted';
}

const CLEANERS: Record<CleanerTarget, { clean: (bytes: Uint8Array) => { kind: string; output?: Uint8Array; removed?: string[] }; check: (bytes: Uint8Array) => string | null }> = {
  jpeg: { clean: cleanJpeg, check: selfCheckJpeg },
  png: { clean: cleanPng, check: selfCheckPng },
  wav: { clean: cleanWav, check: (bytes) => selfCheckAudio('wav', bytes) },
  mp3: { clean: cleanMp3, check: (bytes) => selfCheckAudio('mp3', bytes) },
};

function cleanerCase(target: CleanerTarget, bytes: Uint8Array): CaseResult {
  const original = copy(bytes);
  const { clean, check } = CLEANERS[target];
  const first = clean(bytes);
  if (first.kind !== 'cleaned') {
    if (!equalBytes(bytes, original)) throw new Error(`${target.toUpperCase()} parser mutated rejected input.`);
    return 'rejected'; // Includes documented unsupported formats.
  }

  if (!first.output || !first.removed) throw new Error(`${target.toUpperCase()} cleaner returned an incomplete result.`);
  if (check(first.output) !== null) throw new Error(`${target.toUpperCase()} cleaner emitted output that fails self-check.`);
  if (first.output.length > bytes.length) throw new Error(`${target.toUpperCase()} cleaner expanded its input.`);
  // MP3 cleaning only removes leading/trailing tags, so reporting nothing removed means nothing changed.
  if (target === 'mp3' && first.removed.length === 0 && !equalBytes(first.output, bytes)) throw new Error('MP3 cleaner changed bytes without reporting a removal.');
  const second = clean(first.output);
  if (second.kind !== 'cleaned' || !second.output || !equalBytes(second.output, first.output)) {
    throw new Error(`${target.toUpperCase()} cleaner is not byte-idempotent.`);
  }
  if (!equalBytes(bytes, original)) throw new Error(`${target.toUpperCase()} parser mutated input.`);
  return 'accepted';
}

/** Run one parser case. Rejections are ordinary outcomes; oracle failures throw. */
export function runCase(target: Target, bytes: Uint8Array): CaseResult {
  switch (target) {
    case 'proof':
    case 'timestamp':
      return parseCase(target, bytes);
    case 'jpeg':
    case 'png':
    case 'wav':
    case 'mp3':
      return cleanerCase(target, bytes);
  }
}

export interface SeedCase {
  target: Target;
  bytes: Uint8Array;
  label: string;
}

/** Build a stable, synthetic-only seed corpus from supplied reference proofs. */
export function seedCases(proofs: Uint8Array[]): SeedCase[] {
  const seeds: SeedCase[] = [];
  proofs.forEach((proofBytes, index) => {
    seeds.push({ target: 'proof', bytes: copy(proofBytes), label: `proof-${index}-input` });
    seeds.push({ target: 'proof', bytes: proofBytes.slice(0, Math.max(0, proofBytes.length - 1)), label: `proof-${index}-truncated` });
    let proof: ReturnType<typeof codec.parseProof>;
    try {
      proof = codec.parseProof(proofBytes);
    } catch (error) {
      if (error instanceof UnalteredError) return;
      throw error;
    }
    seeds.push({ target: 'timestamp', bytes: codec.serializeTree(proof.root), label: `timestamp-${index}-valid` });
    seeds.push({ target: 'timestamp', bytes: Uint8Array.of(0x42), label: `timestamp-${index}-unknown-tag` });
  });

  seeds.push(
    { target: 'jpeg', bytes: makeJpeg({ exif: { orientation: 6, gps: true }, xmp: true, trailing: new TextEncoder().encode('SYNTHETIC-TAIL') }), label: 'jpeg-metadata-valid' },
    { target: 'jpeg', bytes: makeJpeg({ noEoi: true }), label: 'jpeg-truncated' },
    { target: 'jpeg', bytes: makeJpeg({ arithmetic: true }), label: 'jpeg-unsupported-arithmetic' },
    { target: 'png', bytes: makePng({ text: true, exif: true, trailing: new TextEncoder().encode('SYNTHETIC-TAIL') }), label: 'png-metadata-valid' },
    { target: 'png', bytes: makePng({ badCrc: true }), label: 'png-bad-crc' },
    { target: 'png', bytes: makePng({ apng: true }), label: 'png-unsupported-apng' },
    { target: 'wav', bytes: makeWav({ extra: true, trailing: 'SYNTHETIC-TAIL' }), label: 'wav-metadata-valid' },
    { target: 'wav', bytes: makeWav({ oddPad: 5 }), label: 'wav-odd-pad-valid' },
    { target: 'wav', bytes: makeWav().slice(0, -1), label: 'wav-truncated' },
    { target: 'wav', bytes: Uint8Array.from([0x52, 0x46, 0x36, 0x34, ...makeWav().subarray(4)]), label: 'wav-unsupported-rf64' },
    { target: 'mp3', bytes: makeMp3({ id3v2: true, ape: true, id3v1: true }), label: 'mp3-metadata-valid' },
    { target: 'mp3', bytes: makeMp3(), label: 'mp3-untagged-valid' },
    { target: 'mp3', bytes: makeMp3().slice(0, -1), label: 'mp3-truncated' },
    { target: 'mp3', bytes: Uint8Array.from([0xff, 0xfb, 0x00, 0x00, ...makeMp3().subarray(4)]), label: 'mp3-unsupported-free-format' },
  );
  return seeds;
}

/** Resolve compile-time exhaustiveness for driver config validation. */
export const TARGETS: readonly Target[] = ['proof', 'timestamp', 'jpeg', 'png', 'wav', 'mp3'];
