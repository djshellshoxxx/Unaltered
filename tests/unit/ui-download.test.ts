import { describe, expect, it } from 'vitest';
import * as dl from '../../src/ui/download';

const { cleanedName, receiptName, safeFileName } = dl;
const upgradedName = (dl as unknown as { upgradedName?: (n: string) => string }).upgradedName ?? ((n: string) => n.replace(/\.ots$/i, '') + '.upgraded.ots');

describe('download names keep their extension when long', () => {
  const long = 'a'.repeat(300);
  it('receipt name still ends in .ots after the final sanitisation', () => {
    expect(safeFileName(receiptName(long)).endsWith('.ots')).toBe(true);
    expect(Array.from(receiptName(long)).length).toBeLessThanOrEqual(200);
  });
  it('receipt of a cleaned copy keeps the cleaned name intact', () => {
    const name = receiptName(cleanedName(`${long}.jpg`, 'jpeg'));
    expect(name.endsWith('-cleaned.jpg.ots')).toBe(true);
    expect(safeFileName(name)).toBe(name);
  });
  it('upgraded receipt name keeps .upgraded.ots', () => {
    const name = upgradedName(`${long}.ots`);
    expect(safeFileName(name).endsWith('.upgraded.ots')).toBe(true);
    expect(upgradedName('a.ots')).toBe('a.upgraded.ots');
  });
});
