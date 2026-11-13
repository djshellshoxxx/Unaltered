import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { archivalReceiptFixture } from '../helpers/archival-receipt';
import { ABSENT_MESSAGE, type Level, type Paper, printCertificate, qrPython, runJson, ZXING_TOOL } from './qr-cert';

/**
 * Opt-in third-party decoder verification (ARCHIVAL_QR_PROTOCOL.md production prerequisite).
 * The app prints a real Chromium PDF; pdftoppm rasterises it; zxing-cpp (not jsQR) decodes every symbol;
 * scripts/recover-archival-qr.py (not TypeScript) reassembles; the result must equal the original .ots bytes.
 * zxing's own reading of each symbol's version, ECC level and mask must equal the printed label.
 */
interface Report {
  recovered: boolean; identical: boolean; error?: string; pages: number; symbols_per_page: number[];
  symbols: { index: number; bytes: number; version: number; ec: string; mask: number }[];
}
const python = qrPython();
const sizes = [200, 3000, 12000] as const;
const cases: { size: number; level: Level; paper: Paper }[] = [
  ...sizes.flatMap(size => (['L', 'M', 'Q', 'H'] as const).map(level => ({ size, level, paper: 'a4' as const }))),
  { size: 3000, level: 'auto', paper: 'a4' }, { size: 3000, level: 'auto', paper: 'letter' }, { size: 12000, level: 'H', paper: 'letter' },
];

test.describe('independent zxing-cpp decoding of printed certificates', () => {
  test.skip(!python, ABSENT_MESSAGE);
  for (const { size, level, paper } of cases) {
    test(`fixture ${size} ECC ${level} ${paper}: zxing-cpp + Python reference recover identical .ots bytes`, async ({ page }) => {
      test.setTimeout(120_000);
      const directory = resolve('test-results/qr-independent', `${size}-${level}-${paper}`); mkdirSync(directory, { recursive: true });
      const original = archivalReceiptFixture(size);
      writeFileSync(resolve(directory, 'original.ots'), original);
      const pdf = resolve(directory, 'certificate.pdf');
      const printed = await printCertificate(page, original, level, paper, pdf);
      const { status, value } = runJson<Report>(python!, [ZXING_TOOL, 'recover-pdf', '--pdf', pdf,
        '--original', resolve(directory, 'original.ots'), '--dpi', '150', '--work', directory]);
      writeFileSync(resolve(directory, 'zxing-report.json'), JSON.stringify({ size: original.length, level, paper, printed, value }, null, 1));
      expect(value.error).toBeUndefined();
      expect(value.recovered).toBe(true);
      expect(value.identical).toBe(true);
      expect(status).toBe(0);
      expect(value.pages).toBe(printed.pages);
      // Cover holds two symbols, continuation pages up to four, the appendix none.
      expect(value.symbols_per_page.at(-1)).toBe(0);
      expect(value.symbols_per_page.reduce((a, b) => a + b, 0)).toBe(printed.labels.length);
      expect(value.symbols.map(s => s.index)).toEqual(printed.labels.map(l => l.index));
      for (const [i, label] of printed.labels.entries()) {
        const seen = value.symbols[i]!;
        expect({ version: seen.version, ec: seen.ec, mask: seen.mask, bytes: seen.bytes })
          .toEqual({ version: label.version, ec: label.level, mask: label.mask, bytes: label.frameBytes });
        if (level !== 'auto') expect(label.level).toBe(level);
      }
    });
  }
});
