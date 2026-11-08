import { describe, expect, it } from 'vitest';
import { createEvidenceManifest } from '../../src/core/reports/evidence-manifest';

describe('local evidence bundle manifest', () => {
  it('records independently verifiable hashes and does not assert Bitcoin confirmation', async () => {
    const file = Uint8Array.from([1, 2, 3, 4]);
    const receipt = Uint8Array.from([5, 6, 7]);
    const result = await createEvidenceManifest(file, receipt);
    expect(result.format).toBe('UNALTERED-EVIDENCE-BUNDLE/1');
    expect(result.original.size).toBe(4);
    expect(result.receipt.size).toBe(3);
    expect(result.original.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.original.sha256).not.toBe(result.receipt.sha256);
    expect(result.verification).toBe('NOT_PERFORMED');
  });
  it('refuses empty evidence', async () => {
    await expect(createEvidenceManifest(new Uint8Array(), Uint8Array.of(1))).rejects.toThrow();
  });
});
