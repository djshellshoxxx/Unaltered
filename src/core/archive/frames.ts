// UNALTERED-OTS-QR/1 binary transport. No QR renderer or PDF generator in this phase.
const HEADER = 80;
const MAX_RECEIPT = 16 * 1024 * 1024;
const MAX_FRAMES = 4096;
// QR Model 2, version 40-L maximum byte-mode capacity (including frame header).
const MAX_QR_BYTES = 2953;
const MAGIC = new TextEncoder().encode('UOTSQR01');
const DOMAIN = new TextEncoder().encode('UNALTERED-OTS-QR/1\0');

function fail(message: string): never { throw new Error('Invalid archival QR frame: ' + message); }
function equal(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
async function digest(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(data)));
}
async function proofId(data: Uint8Array): Promise<Uint8Array> {
  const input = new Uint8Array(DOMAIN.length + data.length);
  input.set(DOMAIN);
  input.set(data, DOMAIN.length);
  return (await digest(input)).slice(0, 16);
}
export async function encodeReceiptFrames(receipt: Uint8Array, maxFrameBytes: number): Promise<Uint8Array[]> {
  if (receipt.length < 1 || receipt.length > MAX_RECEIPT) fail('receipt length');
  if (!Number.isSafeInteger(maxFrameBytes) || maxFrameBytes <= HEADER || maxFrameBytes > MAX_QR_BYTES) fail('frame capacity');
  // Keep the transport bound to the exact input selected before the first await.
  receipt = receipt.slice();
  const capacity = maxFrameBytes - HEADER;
  const total = Math.ceil(receipt.length / capacity);
  if (total > MAX_FRAMES) fail('too many frames');
  const hash = await digest(receipt);
  const id = await proofId(receipt);
  const result: Uint8Array[] = [];
  for (let index = 0; index < total; index++) {
    const chunk = receipt.subarray(index * capacity, Math.min(receipt.length, (index + 1) * capacity));
    const frame = new Uint8Array(HEADER + chunk.length);
    const view = new DataView(frame.buffer);
    frame.set(MAGIC, 0);
    frame[8] = 1;
    frame.set(id, 12);
    view.setUint32(28, index);
    view.setUint32(32, total);
    view.setUint32(36, receipt.length);
    view.setUint32(40, receipt.length);
    frame.set(hash, 44);
    view.setUint32(76, chunk.length);
    frame.set(chunk, HEADER);
    result.push(frame);
  }
  return result;
}

export async function recoverReceiptFrames(frames: readonly Uint8Array[]): Promise<Uint8Array> {
  if (frames.length < 1 || frames.length > MAX_FRAMES) fail('frame count');
  const parts = new Map<number, Uint8Array>();
  let reference: Uint8Array | undefined;
  let total = 0;
  let length = 0;
  for (const frame of frames) {
    if (frame.length <= HEADER || frame.length > MAX_QR_BYTES || !equal(frame.subarray(0, 8), MAGIC)) fail('magic or empty payload');
    if (frame[8] !== 1 || frame[9] !== 0 || frame[10] !== 0 || frame[11] !== 0) fail('version, flags or compression');
    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    const index = view.getUint32(28);
    const count = view.getUint32(32);
    const original = view.getUint32(36);
    const encoded = view.getUint32(40);
    const payloadLength = view.getUint32(76);
    if (!count || count > MAX_FRAMES || index >= count || !original || original > MAX_RECEIPT ||
        encoded !== original || payloadLength !== frame.length - HEADER) fail('invalid lengths or indices');
    if (!reference) {
      reference = frame;
      total = count;
      length = original;
    } else if (count !== total || original !== length ||
        !equal(frame.subarray(12, 28), reference.subarray(12, 28)) ||
        !equal(frame.subarray(44, 76), reference.subarray(44, 76))) fail('inconsistent receipt metadata');
    const payload = frame.slice(HEADER);
    const previous = parts.get(index);
    if (previous && !equal(previous, payload)) fail('conflicting duplicate');
    parts.set(index, payload);
  }
  if (!reference || parts.size !== total) fail('missing frames');
  // Check the partition before allocating: the declared length is attacker-controlled (up to 16 MiB) while the
  // payloads actually present may be a few bytes. Same errors as the copy loop and final length check below.
  let present = 0;
  for (const part of parts.values()) present += part.length;
  if (present > length) fail('invalid partition');
  if (present < length) fail('receipt checksum');
  const receipt = new Uint8Array(length);
  let offset = 0;
  for (let i = 0; i < total; i++) {
    const part = parts.get(i);
    if (!part || offset + part.length > length) fail('invalid partition');
    receipt.set(part, offset);
    offset += part.length;
  }
  if (offset !== length || !equal(await digest(receipt), reference.subarray(44, 76)) ||
      !equal(await proofId(receipt), reference.subarray(12, 28))) fail('receipt checksum');
  return receipt;
}
