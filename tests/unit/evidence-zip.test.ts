import { describe, expect, it } from 'vitest';
import { createEvidenceZip } from '../../src/core/reports/evidence-zip';

describe('portable evidence ZIP', () => {
  it('creates a ZIP with both byte-exact evidence files and a manifest', async () => {
    const bytes = await createEvidenceZip(Uint8Array.of(1, 2), Uint8Array.of(3, 4, 5));
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('original.bin');
    expect(text).toContain('receipt.ots');
    expect(text).toContain('manifest.json');
    expect(text).toContain('NOT_PERFORMED');
  });
  it('round-trips exact bytes through ZIP local records and checks the manifest hashes', async () => {
    const original = Uint8Array.from([0, 1, 2, 3, 254, 255]);
    const receipt = Uint8Array.from([9, 8, 7, 6]);
    const zip = await createEvidenceZip(original, receipt);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const entries = new Map<string, Uint8Array>();
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
      const length = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(zip.subarray(offset + 30, offset + 30 + nameLength));
      const start = offset + 30 + nameLength + extraLength;
      const data = zip.slice(start, start + length);
      let crc = 0xffffffff;
      for (const b of data) {
        crc ^= b;
        for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
      expect((crc ^ 0xffffffff) >>> 0).toBe(view.getUint32(offset + 14, true));
      entries.set(name, data);
      offset = start + length;
    }
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    expect(entries.get('original.bin')).toEqual(original);
    expect(entries.get('receipt.ots')).toEqual(receipt);
    const manifest = JSON.parse(new TextDecoder().decode(entries.get('manifest.json')));
    const hash = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))), b => b.toString(16).padStart(2, '0')).join('');
    expect(manifest.original.sha256).toBe(await hash(original));
    expect(manifest.receipt.sha256).toBe(await hash(receipt));
    expect(manifest.verification).toBe('NOT_PERFORMED');
  });
  it('rejects excessive in-memory inputs before creating the ZIP', async () => {
    await expect(createEvidenceZip(new Uint8Array(16 * 1024 * 1024 + 1), Uint8Array.of(1))).rejects.toThrow();
  });
});
