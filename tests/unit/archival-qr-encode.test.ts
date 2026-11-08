import { describe, expect, it } from 'vitest';
import { encodeArchivalQr, archivalQrSvg } from '../../src/core/archive/qr-encode';
import { recoverReceiptFrames } from '../../src/core/archive/frames';

describe('actual QR Model 2 encoding', () => {
  it('generates valid sized QR matrices and recoverable binary frames', async () => {
    const receipt = Uint8Array.from({length: 900}, (_, i) => i & 255);
    for (const level of ['L', 'M', 'Q', 'H'] as const) {
      const { symbols, plan } = await encodeArchivalQr(receipt, { preference:level });
      expect(symbols.length).toBe(plan.symbols);
      expect(symbols.every(s => s.level === level)).toBe(true);
      expect(symbols.every(s => s.modules === plan.modules)).toBe(true);
      expect(symbols.every(s => s.mask >= 0 && s.mask <= 7)).toBe(true);
      expect(await recoverReceiptFrames(symbols.map(s => s.frame).reverse())).toEqual(receipt);
      const svg = archivalQrSvg(symbols[0]!);
      expect(svg).toContain('shape-rendering="crispEdges"');
      expect(svg).toContain('<rect');
    }
  });
});
