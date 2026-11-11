/**
 * Fuzz targets for the newer hostile-input parsers (Workstream C, 2026-11-11): archival QR frame sets, QR image
 * header inspection, trusted 80-byte block headers and the stored receipt list. Every oracle is independent of the
 * code under test where that is possible (Node's own SHA-256, a separate reference reading of the specification) and
 * every accepted result is checked, not only "did not throw". Implementations are injectable so
 * tests/fuzz/oracles.test.mjs can prove each oracle catches a deliberately broken implementation.
 */
import { createHash } from 'node:crypto';
import { encodeReceiptFrames, recoverReceiptFrames } from '../../src/core/archive/frames';
import { qrImageDimensions } from '../../src/core/archive/qr-image';
import { MAX_QR_IMAGE_PIXELS, MAX_QR_IMAGE_SIDE } from '../../src/core/archive/qr-limits';
import { concat, equalBytes, toHex } from '../../src/core/bytes';
import { UnalteredError } from '../../src/core/errors';
import { collectAttestations, parseProof } from '../../src/core/ots/codec';
import { checkTrustedHeader, verifyWithTrustedHeader, type TrustedHeaderEvidence, type TrustedHeaderState } from '../../src/core/ots/trusted-header';
import { LIMITS } from '../../src/core/ots/types';
import { addReceipt, loadReceipts, removeReceipt, type ReceiptRec } from '../../src/ui/store';

export type HostileTarget = 'qr-frames' | 'qr-image' | 'trusted-header' | 'receipt-store';
export type Outcome = 'accepted' | 'rejected';

const nodeSha256 = (data: Uint8Array): Uint8Array => new Uint8Array(createHash('sha256').update(data).digest());
const u32 = (b: Uint8Array, at: number): number => ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!;
const ascii = (text: string): Uint8Array => new TextEncoder().encode(text);
function unchanged(label: string, now: readonly Uint8Array[], before: readonly Uint8Array[]): void {
  if (now.length !== before.length || now.some((bytes, i) => !equalBytes(bytes, before[i]!))) throw new Error(`${label} mutated its input.`);
}

// ---------------------------------------------------------------------------------------------------------------
// 1. Archival QR frame sets (UNALTERED-OTS-QR/1, docs/ARCHIVAL_QR_PROTOCOL.md)
// ---------------------------------------------------------------------------------------------------------------

/** Spec constants, restated here rather than imported so a wrong product constant is visible. */
const FRAME = { header: 80, maxBytes: 2953, maxFrames: 4096, maxReceipt: 16 * 1024 * 1024 } as const;
const FRAME_MAGIC = ascii('UOTSQR01');
const FRAME_DOMAIN = ascii('UNALTERED-OTS-QR/1\0');
const FRAME_ERROR = 'Invalid archival QR frame: ';
/** The container can name more frames than the 4096-frame limit, so the limit itself is reachable. */
export const MAX_CONTAINER_FRAMES = FRAME.maxFrames + 4;
const REPEAT = 0x8000;

/**
 * Fuzz-input container for a frame list: records of a big-endian u16 word. A word below 0x8000 is the length of the
 * frame bytes that follow (cut short at end of input); a word with the top bit set repeats the previous frame
 * (low 15 bits + 1) more times, which lets a 64 KiB input present more frames than the product limit.
 */
export function decodeFrameContainer(bytes: Uint8Array): Uint8Array[] {
  const frames: Uint8Array[] = [];
  let at = 0;
  while (at + 2 <= bytes.length && frames.length < MAX_CONTAINER_FRAMES) {
    const word = (bytes[at]! << 8) | bytes[at + 1]!;
    at += 2;
    if (word & REPEAT) {
      const previous = frames.at(-1);
      if (!previous) continue;
      for (let n = (word & 0x7fff) + 1; n > 0 && frames.length < MAX_CONTAINER_FRAMES; n--) frames.push(previous);
      continue;
    }
    frames.push(bytes.slice(at, Math.min(bytes.length, at + word)));
    at += word;
  }
  return frames;
}

export function encodeFrameContainer(frames: readonly Uint8Array[], repeatLast = 0): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const frame of frames) parts.push(Uint8Array.of(frame.length >>> 8, frame.length & 255), frame);
  for (let left = repeatLast; left > 0;) {
    const n = Math.min(left, 0x8000);
    parts.push(Uint8Array.of(REPEAT >>> 8 | ((n - 1) >>> 8), (n - 1) & 255));
    left -= n;
  }
  return concat(...parts);
}

const proofIdOf = (receipt: Uint8Array): Uint8Array => nodeSha256(concat(FRAME_DOMAIN, receipt)).slice(0, 16);

/** Independent reading of the protocol table and reassembly rules. Returns the receipt, or null for "must reject". */
export function referenceRecover(frames: readonly Uint8Array[]): Uint8Array | null {
  if (frames.length < 1 || frames.length > FRAME.maxFrames) return null;
  const first = frames[0]!;
  const slots: (Uint8Array | undefined)[] = [];
  let count = 0;
  for (const frame of frames) {
    if (frame.length <= FRAME.header || frame.length > FRAME.maxBytes) return null;
    if (!equalBytes(frame.subarray(0, 8), FRAME_MAGIC) || frame[8] !== 1 || frame[9] !== 0 || frame[10] !== 0 || frame[11] !== 0) return null;
    const index = u32(frame, 28);
    count = u32(frame, 32);
    const original = u32(frame, 36);
    if (count < 1 || count > FRAME.maxFrames || index >= count) return null;
    if (original < 1 || original > FRAME.maxReceipt || u32(frame, 40) !== original) return null;
    if (u32(frame, 76) !== frame.length - FRAME.header) return null;
    // Identical metadata other than index and payload length.
    if (!equalBytes(frame.subarray(0, 28), first.subarray(0, 28)) || !equalBytes(frame.subarray(32, 76), first.subarray(32, 76))) return null;
    const payload = frame.subarray(FRAME.header);
    const previous = slots[index];
    if (previous && !equalBytes(previous, payload)) return null;
    slots[index] = payload;
  }
  const parts: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const part = slots[i];
    if (!part) return null;
    parts.push(part);
  }
  const receipt = concat(...parts);
  if (receipt.length !== u32(first, 36)) return null;
  if (!equalBytes(nodeSha256(receipt), first.subarray(44, 76)) || !equalBytes(proofIdOf(receipt), first.subarray(12, 28))) return null;
  return receipt;
}

export interface FrameImpl {
  recover: (frames: readonly Uint8Array[]) => Promise<Uint8Array>;
  encode: (receipt: Uint8Array, maxFrameBytes: number) => Promise<Uint8Array[]>;
}
const PRODUCT_FRAMES: FrameImpl = { recover: recoverReceiptFrames, encode: encodeReceiptFrames };

export async function qrFramesCase(bytes: Uint8Array, impl: FrameImpl = PRODUCT_FRAMES): Promise<Outcome> {
  const frames = decodeFrameContainer(bytes);
  const before = frames.map((frame) => frame.slice());
  const expected = referenceRecover(frames);
  let receipt: Uint8Array;
  try {
    receipt = await impl.recover(frames);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith(FRAME_ERROR)) {
      throw new Error(`QR frame decoder threw an untyped rejection (${error instanceof Error ? error.name : typeof error}).`, { cause: error });
    }
    unchanged('QR frame decoder', frames, before);
    if (expected) throw new Error('QR frame decoder rejected a frame set the reference reassembles.', { cause: error });
    return 'rejected';
  }
  unchanged('QR frame decoder', frames, before);
  if (!(receipt instanceof Uint8Array)) throw new Error('QR frame decoder returned a non-byte result.');
  if (!expected) throw new Error('QR frame decoder accepted a frame set the reference rejects.');
  if (!equalBytes(receipt, expected)) throw new Error('QR frame decoder reassembled different bytes from the reference.');
  if (frames.length > FRAME.maxFrames || receipt.length < 1 || receipt.length > FRAME.maxReceipt) throw new Error('QR frame decoder accepted a set beyond its limits.');
  // Every accepted frame is bound to the result by both checksums.
  const hash = nodeSha256(receipt);
  const id = proofIdOf(receipt);
  if (frames.some((frame) => !equalBytes(frame.subarray(44, 76), hash) || !equalBytes(frame.subarray(12, 28), id) || u32(frame, 36) !== receipt.length)) {
    throw new Error('QR frame decoder accepted a frame whose checksum does not match the receipt.');
  }
  // Re-encoding round-trips; a canonically chunked set re-encodes to exactly the distinct input frames.
  const distinct = [...new Map(frames.map((frame) => [u32(frame, 28), frame])).entries()].sort((a, b) => a[0] - b[0]).map(([, frame]) => frame);
  const capacity = distinct[0]!.length;
  const encoded = await impl.encode(receipt, capacity);
  const canonical = distinct.every((frame, i) => (i === distinct.length - 1 ? frame.length <= capacity : frame.length === capacity));
  if (canonical && (encoded.length !== distinct.length || encoded.some((frame, i) => !equalBytes(frame, distinct[i]!)))) {
    throw new Error('QR frames of an accepted canonical set do not re-encode to the same frames.');
  }
  if (!equalBytes(await impl.recover(encoded), receipt)) throw new Error('QR frame re-encoding does not round-trip.');
  return 'accepted';
}

/**
 * Mutation helper run by the driver (never in the worker): repair the frames of a container so a mutated set can
 * still pass the checksum and reach the reassembly logic. Mode 0 renumbers frames in container order and rewrites all
 * metadata; mode 1 keeps the existing indices and counts and repairs only lengths and checksums.
 */
export function repairFrames(bytes: Uint8Array, mode: number): Uint8Array {
  const out = bytes.slice();
  const records: { start: number; length: number }[] = [];
  for (let at = 0; at + 2 <= out.length;) {
    const word = (out[at]! << 8) | out[at + 1]!;
    at += 2;
    if (word & REPEAT) continue;
    const length = Math.min(word, out.length - at);
    if (length > FRAME.header) records.push({ start: at, length });
    at += word;
  }
  if (!records.length) return out;
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const renumber = (mode & 1) === 0;
  const slots = new Map<number, Uint8Array>();
  records.forEach(({ start, length }, i) => {
    const frame = out.subarray(start, start + length);
    if (renumber) { frame.set(FRAME_MAGIC); frame.set([1, 0, 0, 0], 8); view.setUint32(start + 28, i); view.setUint32(start + 32, records.length); }
    view.setUint32(start + 76, length - FRAME.header);
    const index = view.getUint32(start + 28);
    if (!slots.has(index)) slots.set(index, frame.subarray(FRAME.header));
  });
  const receipt = concat(...[...slots.entries()].sort((a, b) => a[0] - b[0]).map(([, payload]) => payload));
  const hash = nodeSha256(receipt);
  const id = proofIdOf(receipt);
  for (const { start } of records) {
    view.setUint32(start + 36, receipt.length);
    view.setUint32(start + 40, receipt.length);
    out.set(id, start + 12);
    out.set(hash, start + 44);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// 2. QR image header inspection (PNG/JPEG dimensions before native decode)
// ---------------------------------------------------------------------------------------------------------------

const IMAGE = { minSide: 21, maxSide: 6000, maxPixels: 16_000_000, minBytes: 12, maxBytes: 12 * 1024 * 1024 } as const;
const QR_IMAGE_ERRORS = new Set(['Unsupported QR image size', 'Invalid PNG header', 'Unsupported QR image dimensions', 'Choose a PNG or JPEG image',
  'Invalid JPEG marker', 'Truncated JPEG segment', 'Invalid JPEG frame', 'JPEG dimensions were not found']);
const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
type Dimensions = { width: number; height: number };

const inBounds = ({ width, height }: Dimensions): boolean => Number.isSafeInteger(width) && Number.isSafeInteger(height) &&
  width >= IMAGE.minSide && height >= IMAGE.minSide && width <= IMAGE.maxSide && height <= IMAGE.maxSide && width * height <= IMAGE.maxPixels;

const isStartOfFrame = (marker: number): boolean => marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
/**
 * JPEG segments per ITU T.81 B.1.1, tokenized first and searched second. Stops after the first frame header (a
 * decoder takes its dimensions from there; later bytes are its own concern), at SOS/EOI, or at a malformed marker.
 */
function jpegSegments(bytes: Uint8Array): { marker: number; body: Uint8Array }[] | null {
  const segments: { marker: number; body: Uint8Array }[] = [];
  let at = 2;
  for (;;) {
    if (at >= bytes.length) return segments;
    if (bytes[at] !== 0xff) return null;
    while (at < bytes.length && bytes[at] === 0xff) at++; // A marker may be preceded by any number of fill bytes.
    if (at >= bytes.length) return segments;
    const marker = bytes[at++]!;
    if (marker === 0xd9 || marker === 0xda) return segments;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; // Standalone markers carry no length.
    if (at + 2 > bytes.length) return segments;
    const length = (bytes[at]! << 8) | bytes[at + 1]!;
    if (length < 2 || at + length > bytes.length) return null;
    segments.push({ marker, body: bytes.subarray(at + 2, at + length) });
    if (isStartOfFrame(marker)) return segments;
    at += length;
  }
}

/** Independent reference: the dimensions a decoder reads from the PNG IHDR or the first JPEG SOFn header, or null. */
export function referenceImageDimensions(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < IMAGE.minBytes || bytes.length > IMAGE.maxBytes) return null;
  let found: Dimensions | null = null;
  if (equalBytes(bytes.subarray(0, 8), PNG_SIGNATURE)) {
    // The complete 25-byte IHDR chunk (length, type, 13 data bytes, CRC) must be present.
    if (bytes.length < 8 + 25 || u32(bytes, 8) !== 13 || toHex(bytes.subarray(12, 16)) !== toHex(ascii('IHDR'))) return null;
    found = { width: u32(bytes, 16), height: u32(bytes, 20) };
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const frame = jpegSegments(bytes)?.find(({ marker }) => isStartOfFrame(marker));
    if (!frame || frame.body.length < 6) return null;
    // SOF body: P (1), Y lines (2), X samples per line (2), Nf (1).
    found = { width: (frame.body[3]! << 8) | frame.body[4]!, height: (frame.body[1]! << 8) | frame.body[2]! };
  }
  return found && inBounds(found) ? found : null;
}

export function qrImageCase(bytes: Uint8Array, inspect: (bytes: Uint8Array) => Dimensions = qrImageDimensions): Outcome {
  const before = bytes.slice();
  const expected = referenceImageDimensions(bytes);
  let dims: Dimensions;
  try {
    dims = inspect(bytes);
  } catch (error) {
    if (!(error instanceof Error) || error.constructor !== Error || !QR_IMAGE_ERRORS.has(error.message)) {
      throw new Error(`QR image inspection threw an untyped rejection (${error instanceof Error ? error.name : typeof error}).`, { cause: error });
    }
    unchanged('QR image inspection', [bytes], [before]);
    if (expected) throw new Error('QR image inspection rejected a header the reference reads.', { cause: error });
    return 'rejected';
  }
  unchanged('QR image inspection', [bytes], [before]);
  // Both the specification's limits and the product's exported ones (a changed constant must not widen acceptance).
  if (!dims || !inBounds(dims) || dims.width > MAX_QR_IMAGE_SIDE || dims.height > MAX_QR_IMAGE_SIDE || dims.width * dims.height > MAX_QR_IMAGE_PIXELS) {
    throw new Error('QR image inspection accepted dimensions outside its limits.');
  }
  if (!expected) throw new Error('QR image inspection accepted a header the reference rejects.');
  if (dims.width !== expected.width || dims.height !== expected.height) throw new Error('QR image inspection reported dimensions different from the declared header.');
  // Metamorphic: bytes after a complete header cannot change it, and a JPEG application segment before it is skipped.
  const same = (variant: Uint8Array, label: string): void => {
    let other: Dimensions;
    try { other = inspect(variant); } catch { throw new Error(`QR image inspection rejected the header after ${label}.`); }
    if (other.width !== dims.width || other.height !== dims.height) throw new Error(`QR image inspection changed dimensions after ${label}.`);
  };
  if (bytes.length + 16 <= IMAGE.maxBytes) same(concat(bytes, ascii('SYNTHETIC-TAIL'), Uint8Array.of(0xff, 0xd9)), 'appending trailing bytes');
  if (bytes[0] === 0xff) same(concat(bytes.subarray(0, 2), Uint8Array.of(0xff, 0xef, 0, 8), ascii('UNALTR'), bytes.subarray(2)), 'inserting an application segment');
  return 'accepted';
}

// ---------------------------------------------------------------------------------------------------------------
// 3. Trusted 80-byte block header parsing and comparison (src/core/ots/trusted-header.ts)
// ---------------------------------------------------------------------------------------------------------------

const STATES: readonly TrustedHeaderState[] = ['MATCHED_TRUSTED_HEADER', 'PENDING', 'NO_MATCH_FILE', 'INVALID_PROOF', 'INVALID_HEADER', 'MISSING_HEADER', 'NO_MATCH_HEADER'];
const HOSTILE_HEIGHTS = [-1, 0.5, Number.NaN, Infinity, 2 ** 32, 2 ** 32 - 1, Number.MAX_SAFE_INTEGER + 2] as const;
const blockHashHex = (raw: Uint8Array): string => toHex(nodeSha256(nodeSha256(raw)).reverse());

type HeaderCase = { fileDigest: Uint8Array; ots: Uint8Array; evidence: TrustedHeaderEvidence };
/**
 * Input layout: mode byte, then up to 80 header bytes, then the .ots receipt. Mode bits: 0-1 hash form (exact,
 * upper case, one nibble wrong, trailing newline); 2 splice the first Bitcoin attestation's commitment into the
 * header Merkle root; 3-4 height (attested, attested+1, header nonce, hostile number); 5 file digest from the
 * receipt; 6 header as an offset view into a larger buffer; 7 non-string hash.
 */
export function trustedHeaderInputs(bytes: Uint8Array): HeaderCase {
  const mode = bytes[0] ?? 0;
  const raw = bytes.slice(1, 81);
  const ots = bytes.slice(81);
  let bitcoin: { msg: Uint8Array; height: number } | undefined;
  let digest: Uint8Array | undefined;
  try {
    const proof = parseProof(ots);
    digest = proof.digest;
    const first = collectAttestations(proof.root).find(({ attestation }) => attestation.kind === 'bitcoin');
    if (first && first.attestation.kind === 'bitcoin') bitcoin = { msg: first.node.msg, height: first.attestation.height };
  } catch (error) {
    if (!(error instanceof UnalteredError)) throw error;
  }
  if (mode & 4 && bitcoin && raw.length === 80) raw.set(bitcoin.msg.subarray(0, 32), 36);
  const heightMode = (mode >> 3) & 3;
  const height = heightMode === 0 ? bitcoin?.height ?? 0 : heightMode === 1 ? (bitcoin?.height ?? 0) + 1
    : heightMode === 2 ? (raw.length >= 80 ? new DataView(raw.buffer).getUint32(76, true) : 0) : HOSTILE_HEIGHTS[(raw[0] ?? 0) % HOSTILE_HEIGHTS.length]!;
  const exact = blockHashHex(raw);
  const hashForm = mode & 3;
  const hashHex = hashForm === 0 ? exact : hashForm === 1 ? exact.toUpperCase()
    : hashForm === 2 ? exact.slice(0, 63) + (exact[63] === '0' ? '1' : '0') : `${exact}\n`;
  let header = raw;
  if (mode & 64) { const wide = new Uint8Array(raw.length + 7); wide.set(raw, 3); header = wide.subarray(3, 3 + raw.length); }
  const fileDigest = mode & 32 && digest ? digest.slice() : nodeSha256(ots);
  // Bit 7 passes a number where the hash string belongs, as untyped CLI/JSON callers could.
  const evidence = { height, hashHex: (mode & 128 ? exact.length : hashHex) as string, raw: header };
  return { fileDigest, ots, evidence };
}

/** The header check the specification states, computed with Node's hash rather than the product's. */
function headerAccepted({ height, hashHex, raw }: TrustedHeaderEvidence): boolean {
  return Number.isInteger(height) && height >= 0 && height <= 0xffff_ffff && typeof hashHex === 'string' && /^[0-9a-fA-F]{64}$/.test(hashHex) &&
    raw instanceof Uint8Array && raw.length === 80 && hashHex.toLowerCase() === blockHashHex(raw);
}

/** Independent state model for verifyWithTrustedHeader, in the documented order of checks. */
function expectedState({ fileDigest, ots, evidence }: HeaderCase): TrustedHeaderState {
  if (!headerAccepted(evidence)) return 'INVALID_HEADER';
  let proof;
  try { proof = parseProof(ots); } catch { return 'INVALID_PROOF'; }
  if (!equalBytes(fileDigest, proof.digest)) return 'NO_MATCH_FILE';
  const bitcoin = collectAttestations(proof.root).flatMap(({ node, attestation }) => (attestation.kind === 'bitcoin' ? [{ msg: node.msg, height: attestation.height }] : []));
  if (!bitcoin.length) return 'PENDING';
  if (new Set(bitcoin.map(({ msg, height }) => `${height}:${toHex(msg)}`)).size > LIMITS.maxDistinctBitcoin) return 'INVALID_PROOF';
  const atHeight = bitcoin.filter(({ height }) => height === evidence.height);
  if (!atHeight.length) return 'MISSING_HEADER';
  const root = evidence.raw.subarray(36, 68);
  return atHeight.some(({ msg }) => equalBytes(msg, root)) ? 'MATCHED_TRUSTED_HEADER' : 'NO_MATCH_HEADER';
}

export interface TrustedHeaderImpl { check: typeof checkTrustedHeader; verify: typeof verifyWithTrustedHeader }
const PRODUCT_HEADER: TrustedHeaderImpl = { check: checkTrustedHeader, verify: verifyWithTrustedHeader };

export function trustedHeaderCase(bytes: Uint8Array, impl: TrustedHeaderImpl = PRODUCT_HEADER): Outcome {
  const input = trustedHeaderInputs(bytes);
  const { fileDigest, ots, evidence } = input;
  const before = [fileDigest.slice(), ots.slice(), evidence.raw.slice()];
  const accepted = headerAccepted(evidence);
  let header: ReturnType<typeof checkTrustedHeader> | undefined;
  try {
    header = impl.check(evidence);
  } catch (error) {
    if (!(error instanceof UnalteredError) || error.code !== 'SOURCE_INVALID') throw new Error('Trusted header check threw an untyped rejection.', { cause: error });
    if (accepted) throw new Error('Trusted header check rejected a header that hashes to the supplied identity.', { cause: error });
  }
  if (header) {
    if (!accepted) throw new Error('Trusted header check accepted a header that does not match the supplied identity.');
    const raw = evidence.raw;
    if (header.hashHex !== blockHashHex(raw) || !equalBytes(header.merkleRoot, raw.subarray(36, 68)) ||
        header.time !== new DataView(raw.buffer, raw.byteOffset, 80).getUint32(68, true) || !equalBytes(header.raw, raw)) {
      throw new Error('Trusted header fields differ from the 80 supplied bytes.');
    }
    // The parsed header must be a private snapshot: a later change to the caller's bytes cannot change it.
    raw[36] = raw[36]! ^ 0xff;
    const aliased = header.merkleRoot[0] !== before[2]![36] || header.raw[36] !== before[2]![36];
    raw[36] = raw[36]! ^ 0xff;
    if (aliased) throw new Error('Trusted header result aliases the caller\'s bytes.');
  }
  const report = impl.verify(fileDigest, ots, evidence); // Must never throw: any exception escapes as a finding.
  unchanged('Trusted header verification', [fileDigest, ots, evidence.raw], before);
  if (report.trust !== 'USER_SUPPLIED_HEADER' || !STATES.includes(report.state) || typeof report.detail !== 'string' || !report.detail) {
    throw new Error('Trusted header report has an invalid shape.');
  }
  const want = expectedState(input);
  if (report.state !== want) throw new Error(`Trusted header verification returned ${report.state}; the specification gives ${want}.`);
  if (want === 'MATCHED_TRUSTED_HEADER') {
    const time = new DataView(evidence.raw.buffer, evidence.raw.byteOffset, 80).getUint32(68, true);
    const iso = new Date(time * 1000).toISOString().replace('.000Z', 'Z');
    if (!report.bitcoin || report.bitcoin.height !== evidence.height || report.bitcoin.hashHex !== blockHashHex(evidence.raw) || report.bitcoin.blockTimeUtc !== iso) {
      throw new Error('Trusted header match reports the wrong block.');
    }
    return 'accepted';
  }
  if (report.bitcoin) throw new Error('Trusted header report names a block without a match.');
  return 'rejected';
}

// ---------------------------------------------------------------------------------------------------------------
// 4. Stored receipt list (src/ui/store.ts, hostile localStorage JSON)
// ---------------------------------------------------------------------------------------------------------------

const STORE_KEY = 'unaltered.receipts.v1';
const STORE_FLAG = 'unaltered.receipts.enabled';
const RECORD_KEYS = ['digestHex', 'createdAtUtc', 'label'];
const SYNTHETIC_RECORD: ReceiptRec = { digestHex: 'c0'.repeat(32), createdAtUtc: '2026-11-11T00:00:00Z', label: 'synthetic fuzz record' };

class MemoryStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
  removeItem(key: string): void { this.data.delete(key); }
}

/** Independent model of the documented contract: first 500 stored records, invalid ones dropped, fields bounded. */
function expectedReceipts(raw: string): ReceiptRec[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const out: ReceiptRec[] = [];
  for (const item of parsed.slice(0, 500) as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const { digestHex, createdAtUtc, label } = item as Record<string, unknown>;
    if (typeof digestHex !== 'string' || !/^[0-9a-f]{64}$/.test(digestHex) || typeof createdAtUtc !== 'string' || typeof label !== 'string') continue;
    out.push({ digestHex, createdAtUtc: createdAtUtc.slice(0, 40), label: label.slice(0, 200) });
  }
  return out;
}

function assertRecordList(list: unknown, where: string): asserts list is ReceiptRec[] {
  if (!Array.isArray(list) || list.length > 500) throw new Error(`Receipt list ${where} is not a bounded array.`);
  for (const record of list as unknown[]) {
    if (typeof record !== 'object' || record === null || Object.getPrototypeOf(record) !== Object.prototype ||
        JSON.stringify(Object.keys(record)) !== JSON.stringify(RECORD_KEYS)) {
      throw new Error(`Receipt list ${where} holds a field other than digest, time and label.`);
    }
    const { digestHex, createdAtUtc, label } = record as Record<string, unknown>;
    if (typeof digestHex !== 'string' || !/^[0-9a-f]{64}$/.test(digestHex) || typeof createdAtUtc !== 'string' || createdAtUtc.length > 40 ||
        typeof label !== 'string' || label.length > 200) {
      throw new Error(`Receipt list ${where} holds an invalid record.`);
    }
  }
}
const sameRecords = (a: readonly ReceiptRec[], b: readonly ReceiptRec[]): boolean => JSON.stringify(a) === JSON.stringify(b);

export interface StoreImpl { load: typeof loadReceipts; add: typeof addReceipt; remove: typeof removeReceipt }
const PRODUCT_STORE: StoreImpl = { load: loadReceipts, add: addReceipt, remove: removeReceipt };

export function receiptStoreCase(bytes: Uint8Array, impl: StoreImpl = PRODUCT_STORE): Outcome {
  const raw = new TextDecoder().decode(bytes);
  const storage = new MemoryStorage();
  storage.setItem(STORE_FLAG, '1');
  storage.setItem(STORE_KEY, raw);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  try {
    const loaded = impl.load(); // Must not throw: any exception escapes as a finding.
    assertRecordList(loaded, 'loaded from hostile storage');
    const want = expectedReceipts(raw);
    if (!sameRecords(loaded, want)) throw new Error('Receipt list kept or dropped different records from the documented contract.');
    if (storage.getItem(STORE_KEY) !== raw) throw new Error('Loading the receipt list rewrote storage.');

    // A write after hostile data must store only well-formed three-field records, never anything else it read.
    if (impl.add(SYNTHETIC_RECORD) !== true) throw new Error('Receipt list refused a valid record after hostile data.');
    const stored: unknown = JSON.parse(storage.getItem(STORE_KEY) ?? 'null');
    assertRecordList(stored, 'written after hostile data');
    const rest = loaded.filter((r) => !(r.digestHex === SYNTHETIC_RECORD.digestHex && r.createdAtUtc === SYNTHETIC_RECORD.createdAtUtc));
    if (!sameRecords(stored, [SYNTHETIC_RECORD, ...rest].slice(0, 500))) throw new Error('Receipt list write lost, reordered or invented records.');
    if (impl.remove(SYNTHETIC_RECORD) !== true) throw new Error('Receipt list could not remove the record it just stored.');
    const after: unknown = JSON.parse(storage.getItem(STORE_KEY) ?? 'null');
    assertRecordList(after, 'after removal');
    if (!sameRecords(after, stored.slice(1))) throw new Error('Receipt list removal changed other records.');
    return loaded.length ? 'accepted' : 'rejected';
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Dispatch and synthetic seeds
// ---------------------------------------------------------------------------------------------------------------

export const HOSTILE_TARGETS: readonly HostileTarget[] = ['qr-frames', 'qr-image', 'trusted-header', 'receipt-store'];

export function runHostileCase(target: HostileTarget, bytes: Uint8Array): Outcome | Promise<Outcome> {
  switch (target) {
    case 'qr-frames': return qrFramesCase(bytes);
    case 'qr-image': return qrImageCase(bytes);
    case 'trusted-header': return trustedHeaderCase(bytes);
    case 'receipt-store': return receiptStoreCase(bytes);
  }
}

/** Half of qr-frames mutations are repaired (in one of two modes); other targets are returned unchanged and draw no randomness. */
export function repairHostileCase(target: string, bytes: Uint8Array, random: (n: number) => number): Uint8Array {
  return target === 'qr-frames' && random(2) ? repairFrames(bytes, random(2)) : bytes;
}

const be16 = (n: number): Uint8Array => Uint8Array.of(n >>> 8, n & 255);
const be32 = (n: number): Uint8Array => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const seg = (marker: number, body: Uint8Array): Uint8Array => concat(Uint8Array.of(0xff, marker), be16(body.length + 2), body);
const png = (width: number, height: number): Uint8Array =>
  concat(PNG_SIGNATURE, be32(13), ascii('IHDR'), be32(width), be32(height), Uint8Array.of(8, 2, 0, 0, 0), be32(0), be32(0), ascii('IEND'), be32(0xae426082));
const jpeg = (width: number, height: number, sof = 0xc0, before: Uint8Array[] = []): Uint8Array =>
  concat(Uint8Array.of(0xff, 0xd8), ...before, seg(sof, concat(Uint8Array.of(8), be16(height), be16(width), Uint8Array.of(1, 1, 0x11, 0))), Uint8Array.of(0xff, 0xd9));
const store = (value: unknown): Uint8Array => ascii(JSON.stringify(value));
const hex64 = (n: number): string => n.toString(16).padStart(64, '0');

export interface HostileSeed { target: HostileTarget; bytes: Uint8Array; label: string }

/** Synthetic seeds built from repository fixtures (the reference proofs and the golden frame) and generated data only. */
export async function hostileSeeds(proofs: readonly Uint8Array[], goldenHex: string): Promise<HostileSeed[]> {
  const seeds: HostileSeed[] = [];
  const golden = Uint8Array.from(Buffer.from(goldenHex.split(/\r?\n/).filter((line) => !line.startsWith('#')).join('').trim(), 'hex'));
  seeds.push({ target: 'qr-frames', bytes: encodeFrameContainer([golden]), label: 'frames-golden-v1' });
  seeds.push({ target: 'qr-frames', bytes: encodeFrameContainer([golden], FRAME.maxFrames), label: 'frames-golden-over-frame-limit' });
  seeds.push({ target: 'qr-frames', bytes: encodeFrameContainer([golden], FRAME.maxFrames - 1), label: 'frames-golden-at-frame-limit' });
  for (const [index, proof] of proofs.entries()) {
    const small = await encodeReceiptFrames(proof, 81 + (index * 37) % 120);
    const large = await encodeReceiptFrames(proof, 2953);
    seeds.push({ target: 'qr-frames', bytes: encodeFrameContainer([...small].reverse()), label: `frames-proof-${index}-reversed` });
    seeds.push({ target: 'qr-frames', bytes: encodeFrameContainer(large), label: `frames-proof-${index}-single` });
    seeds.push({ target: 'qr-frames', bytes: encodeFrameContainer([...small, small[0]!]), label: `frames-proof-${index}-duplicate` });
    if (small.length > 1) seeds.push({ target: 'qr-frames', bytes: encodeFrameContainer(small.slice(1)), label: `frames-proof-${index}-missing` });
    const conflicting = small[0]!.slice(); conflicting[conflicting.length - 1] = conflicting.at(-1)! ^ 1;
    seeds.push({ target: 'qr-frames', bytes: encodeFrameContainer([...small, conflicting]), label: `frames-proof-${index}-conflict` });
  }
  if (proofs.length >= 2) {
    const a = await encodeReceiptFrames(proofs[0]!, 120);
    const b = await encodeReceiptFrames(proofs[1]!, 120);
    seeds.push({ target: 'qr-frames', bytes: encodeFrameContainer([a[0]!, ...b.slice(1)]), label: 'frames-mixed-receipts' });
  }
  // Non-canonical but specification-valid partition: chunks of unequal size.
  seeds.push({ target: 'qr-frames', bytes: repairFrames(encodeFrameContainer([concat(golden.subarray(0, 80), Uint8Array.of(1)), concat(golden.subarray(0, 80), Uint8Array.of(2, 3, 4))]), 0), label: 'frames-uneven-chunks' });

  seeds.push(
    { target: 'qr-image', bytes: png(740, 740), label: 'png-740' },
    { target: 'qr-image', bytes: png(6000, 2666), label: 'png-at-pixel-limit' },
    { target: 'qr-image', bytes: png(4000, 4001), label: 'png-over-pixel-limit' },
    { target: 'qr-image', bytes: png(6001, 21), label: 'png-over-side-limit' },
    { target: 'qr-image', bytes: png(20, 740), label: 'png-under-side-limit' },
    { target: 'qr-image', bytes: png(740, 740).slice(0, 32), label: 'png-truncated-ihdr' },
    { target: 'qr-image', bytes: jpeg(768, 512), label: 'jpeg-baseline' },
    { target: 'qr-image', bytes: jpeg(2480, 3508, 0xc2, [seg(0xe0, ascii('JFIF\0\x01\x01')), Uint8Array.of(0xff, 0xff, 0xff), seg(0xfe, ascii('synthetic comment'))]), label: 'jpeg-progressive-fill-bytes' },
    { target: 'qr-image', bytes: jpeg(600, 600, 0xc0, [seg(0xc4, new Uint8Array(20)), Uint8Array.of(0xff, 0xd0, 0xff, 0x01), seg(0xcc, new Uint8Array(4))]), label: 'jpeg-tables-and-standalone' },
    { target: 'qr-image', bytes: jpeg(16_000, 16_000), label: 'jpeg-oversized' },
    { target: 'qr-image', bytes: jpeg(768, 512).slice(0, 14), label: 'jpeg-truncated' },
    { target: 'qr-image', bytes: concat(Uint8Array.of(0xff, 0xd8), seg(0xda, new Uint8Array(6)), seg(0xc0, new Uint8Array(9))), label: 'jpeg-frame-after-scan' },
  );

  for (const [index, proof] of proofs.entries()) {
    for (const mode of [0b0010_0100, 0b0010_0101, 0b0010_0110, 0b0010_0111, 0b0010_1100, 0b0011_0100, 0b0011_1100, 0b0110_0100, 0b1010_0100, 0b0000_0100]) {
      seeds.push({ target: 'trusted-header', bytes: concat(Uint8Array.of(mode), new Uint8Array(80).fill(mode), proof), label: `header-${index}-mode-${mode}` });
    }
  }
  seeds.push({ target: 'trusted-header', bytes: Uint8Array.of(0, 1, 2, 3), label: 'header-short' });

  const valid = { digestHex: hex64(1), createdAtUtc: '2026-11-01T00:00:00Z', label: 'one' };
  seeds.push(
    { target: 'receipt-store', bytes: store([valid, { ...valid, digestHex: hex64(2), label: '' }]), label: 'store-valid' },
    { target: 'receipt-store', bytes: store([{ ...valid, fileName: 'synthetic-name.pdf', name: 'x', path: '/synthetic/path' }]), label: 'store-extra-fields' },
    { target: 'receipt-store', bytes: store([{ ...valid, digestHex: hex64(3).toUpperCase() }, { ...valid, digestHex: 5 }, null, 'x', [], { ...valid, label: 7 }]), label: 'store-wrong-types' },
    { target: 'receipt-store', bytes: store([{ ...valid, createdAtUtc: 'T'.repeat(80), label: 'L'.repeat(300) }, { ...valid, label: '😀'.repeat(120) }]), label: 'store-long-fields' },
    { target: 'receipt-store', bytes: store(Array.from({ length: 501 }, (_, i) => ({ digestHex: hex64(i), createdAtUtc: String(i), label: '' }))), label: 'store-over-limit' },
    { target: 'receipt-store', bytes: store([SYNTHETIC_RECORD, valid]), label: 'store-same-identity' },
    { target: 'receipt-store', bytes: ascii(`[{"__proto__":{"digestHex":"${hex64(9)}"},"digestHex":"${hex64(4)}","createdAtUtc":"t","label":"p"}]`), label: 'store-proto-key' },
    { target: 'receipt-store', bytes: ascii('[[[[[[[[[[[[[[[[{}]]]]]]]]]]]]]]]]'), label: 'store-nested' },
    { target: 'receipt-store', bytes: ascii('{"digestHex":"'), label: 'store-invalid-json' },
    { target: 'receipt-store', bytes: Uint8Array.of(0x5b, 0xff, 0xfe, 0x5d), label: 'store-invalid-utf8' },
  );
  return seeds;
}
