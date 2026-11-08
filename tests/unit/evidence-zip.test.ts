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
  it('rejects excessive in-memory inputs before creating the ZIP', async () => {
    await expect(createEvidenceZip(new Uint8Array(16 * 1024 * 1024 + 1), Uint8Array.of(1))).rejects.toThrow();
  });
});
