import { describe, expect, it } from 'vitest';
import { pairEvidenceFiles } from '../../src/core/reports/batch-pair';

describe('batch file/receipt pairing', () => {
  it('pairs exact original filenames with .ots receipts regardless of input order', () => {
    const result = pairEvidenceFiles(['a.txt', 'b.txt'], ['b.txt.ots', 'a.txt.ots']);
    expect(result).toEqual([{ fileName: 'a.txt', receiptName: 'a.txt.ots' }, { fileName: 'b.txt', receiptName: 'b.txt.ots' }]);
  });
  it('rejects missing and duplicate names instead of silently pairing wrong files', () => {
    expect(() => pairEvidenceFiles(['a.txt'], ['b.txt.ots'])).toThrow();
    expect(() => pairEvidenceFiles(['a.txt', 'a.txt'], ['a.txt.ots'])).toThrow();
    expect(() => pairEvidenceFiles(['a.txt'], ['a.txt.ots', 'a.txt.ots'])).toThrow();
  });
  it('enforces a bounded count and rejects unpaired extras', () => {
    expect(() => pairEvidenceFiles(['a'], ['a.ots', 'b.ots'])).toThrow();
    expect(() => pairEvidenceFiles(Array.from({ length: 51 }, (_, i) => String(i)), [])).toThrow();
  });
  it('rejects unnamed originals and receipts before creating misleading evidence pairs', () => {
    expect(() => pairEvidenceFiles([''], ['.ots'])).toThrow(/non-empty/i);
    expect(() => pairEvidenceFiles(['named.txt'], [''])).toThrow(/non-empty/i);
    expect(() => pairEvidenceFiles(['named.txt', ''], ['named.txt.ots', '.ots'])).toThrow(/non-empty/i);
  });
  it('preserves exact-case and Unicode filename identity without guessing', () => {
    expect(pairEvidenceFiles(['Résumé.txt', 'notes.ots'], ['notes.ots.ots', 'Résumé.txt.ots']))
      .toEqual([
        { fileName: 'Résumé.txt', receiptName: 'Résumé.txt.ots' },
        { fileName: 'notes.ots', receiptName: 'notes.ots.ots' },
      ]);
    expect(() => pairEvidenceFiles(['Résumé.txt'], ['résumé.txt.ots'])).toThrow();
    expect(() => pairEvidenceFiles(['é.txt'], ['e\u0301.txt.ots'])).toThrow();
  });
  it('accepts exactly 50 unambiguous pairs regardless of receipt order', () => {
    const originals = Array.from({ length: 50 }, (_, i) => `file-${i}.bin`);
    const receipts = originals.map(name => name + '.ots').reverse();
    const result = pairEvidenceFiles(originals, receipts);
    expect(result).toHaveLength(50);
    expect(result[0]).toEqual({ fileName: 'file-0.bin', receiptName: 'file-0.bin.ots' });
    expect(result[49]).toEqual({ fileName: 'file-49.bin', receiptName: 'file-49.bin.ots' });
  });
});
