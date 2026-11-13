import { createEvidenceManifest } from './evidence-manifest';

const MAX_BYTES = 16 * 1024 * 1024;
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = crcTable[(c ^ byte) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u16(data: Uint8Array, at: number, n: number): void { new DataView(data.buffer).setUint16(at, n, true); }
function u32(data: Uint8Array, at: number, n: number): void { new DataView(data.buffer).setUint32(at, n, true); }

/** Stored ZIP, no compression or external dependencies. Bounded to avoid excessive browser allocations. */
export async function createEvidenceZip(original: Uint8Array, receipt: Uint8Array): Promise<Uint8Array> {
  if (!original.length || !receipt.length || original.length + receipt.length > MAX_BYTES)
    throw new Error('Evidence bundle inputs must be nonempty and at most 16 MiB combined');
  // Snapshot once, before any await: the caller may reuse its buffers while hashes are computed.
  // The manifest digests, stored ZIP entries and CRCs must describe the same exact bytes.
  const originalBytes = Uint8Array.from(original);
  const receiptBytes = Uint8Array.from(receipt);
  const manifest = await createEvidenceManifest(originalBytes, receiptBytes);
  const files = [
    { name: 'manifest.json', data: encoder.encode(JSON.stringify(manifest, null, 2) + '\n') },
    { name: 'original.bin', data: originalBytes },
    { name: 'receipt.ots', data: receiptBytes },
  ];
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    u32(local, 0, 0x04034b50);
    u16(local, 4, 20);
    u16(local, 12, 0x0021);
    u32(local, 14, crc);
    u32(local, 18, file.data.length);
    u32(local, 22, file.data.length);
    u16(local, 26, name.length);
    local.set(name, 30);
    parts.push(local, file.data);
    const central = new Uint8Array(46 + name.length);
    u32(central, 0, 0x02014b50);
    u16(central, 4, 20);
    u16(central, 6, 20);
    u16(central, 14, 0x0021);
    u32(central, 16, crc);
    u32(central, 20, file.data.length);
    u32(central, 24, file.data.length);
    u16(central, 28, name.length);
    u32(central, 42, offset);
    central.set(name, 46);
    directory.push(central);
    offset += local.length + file.data.length;
  }
  const dirSize = directory.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  u32(end, 0, 0x06054b50);
  u16(end, 8, files.length);
  u16(end, 10, files.length);
  u32(end, 12, dirSize);
  u32(end, 16, offset);
  const result = new Uint8Array(offset + dirSize + end.length);
  let cursor = 0;
  for (const part of [...parts, ...directory, end]) {
    result.set(part, cursor);
    cursor += part.length;
  }
  return result;
}
