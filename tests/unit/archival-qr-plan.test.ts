import { describe, expect, it } from 'vitest';
import { planArchivalQr } from '../../src/core/archive/qr-plan';

describe('archival QR print planning', () => {
  it('defaults to automatic error correction', () => {
    const plan = planArchivalQr(200);
    expect(['L','M','Q','H']).toContain(plan.level);
    expect(plan.framePayloadCapacity).toBe(plan.byteCapacity - 80);
    expect(plan.pages).toBeGreaterThan(0);
  });
  it('honors all manual error correction levels', () => {
    for (const level of ['L','M','Q','H'] as const) {
      expect(planArchivalQr(1000, { preference:level }).level).toBe(level);
    }
  });
  it('plans more symbols for larger receipts and respects page limits', () => {
    const small = planArchivalQr(100, { preference:'H' });
    const large = planArchivalQr(60000, { preference:'H' });
    expect(large.symbols).toBeGreaterThan(small.symbols);
    expect(large.pages).toBeGreaterThanOrEqual(small.pages);
    expect(() => planArchivalQr(16*1024*1024, { maxPages:1 })).toThrow();
  });
  it('rejects invalid inputs and unsupported preferences', () => {
    expect(() => planArchivalQr(0)).toThrow();
    expect(() => planArchivalQr(-1)).toThrow();
    expect(() => planArchivalQr(100, { preference:'X' as 'H' })).toThrow();
    expect(() => planArchivalQr(100, { minModuleMm:0.1 })).toThrow();
  });
  it('supports both paper sizes and conservative quiet zones', () => {
    for (const paper of ['a4','letter'] as const) {
      const plan = planArchivalQr(100, { paper });
      expect(plan.paper).toBe(paper);
      expect(plan.modules).toBe(plan.version * 4 + 17);
      expect(plan.moduleSizeMm).toBeGreaterThanOrEqual(0.35);
    }
  });
});

it('counts the full technical appendix and uses print-safe physical symbol dimensions', () => {
  const plan = planArchivalQr(100, { preference: 'H' });
  expect(plan.pages).toBe(2); // certificate plus self-contained recovery appendix
  expect(plan.moduleSizeMm * (plan.modules + 8)).toBeCloseTo(72);
  expect(plan.version).toBeLessThan(20);
});
