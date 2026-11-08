import { describe, expect, it } from 'vitest';
import { verifyBatch } from '../../src/core/reports/batch-verify';

describe('bounded batch verification', () => {
  it('keeps per-item results and never upgrades a pending result to verified', async () => {
    const calls: string[] = [];
    const results = await verifyBatch(['one', 'two', 'three'], async (name) => {
      calls.push(name);
      if (name === 'two') throw new Error('Unreadable receipt');
      return { state: 'PENDING' as const, detail: 'Awaiting confirmation' };
    });
    expect(calls).toEqual(['one', 'two', 'three']);
    expect(results.map(r => r.status)).toEqual(['PENDING', 'ERROR', 'PENDING']);
    expect(results[1]!.error).toContain('Unreadable receipt');
  });
  it('rejects unbounded batches before executing any work', async () => {
    let called = false;
    await expect(verifyBatch(Array.from({ length: 51 }, (_, i) => i), async () => {
      called = true;
      return { state: 'PENDING' as const, detail: '' };
    })).rejects.toThrow();
    expect(called).toBe(false);
  });
  it('rejects an empty batch', async () => {
    await expect(verifyBatch([], async () => ({ state: 'PENDING' as const, detail: '' }))).rejects.toThrow();
  });
});
