import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeArchivalQr } from '../../src/core/archive/qr-encode';
import { createArchivalPrintSheet, type CertificateContext } from '../../src/core/archive/qr-print';
import { archivalReceiptFixture } from '../helpers/archival-receipt';
import { doc, FElement, installFakeDom } from './ui-fake-dom';

const sha256Hex = async (bytes: Uint8Array): Promise<string> =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))), b => b.toString(16).padStart(2, '0')).join('');

let restoreDom: () => void;
beforeEach(() => {
  restoreDom = installFakeDom();
  vi.spyOn(doc, 'createElement').mockImplementation(tag => {
    const node = new FElement(tag.toUpperCase());
    return tag === 'canvas' ? Object.assign(node, { getContext: () => ({ fillStyle: '', fillRect() {} }) }) : node;
  });
});
afterEach(() => { vi.restoreAllMocks(); restoreDom(); });

describe('verified certificate evidence', () => {
  // The Verify flow requires a quorum of at least two independent explorers. One host counted twice is not a quorum,
  // so the print sheet must not print "Verified" for it even if a caller passes such evidence.
  it.each([
    [['mempool.space', 'mempool.space']],
    [['mempool.space', 'MEMPOOL.SPACE']],
    [['mempool.space', '']],
    [['mempool.space', ' mempool.space ']],
    [['mempool.space', '   ']],
    [Object.assign(Array<string>(2), { 0: 'mempool.space' })],
  ])('refuses a verified claim whose agreeing sources are not two distinct hosts: %j', async sources => {
    const receipt = archivalReceiptFixture(200);
    const { symbols } = await encodeArchivalQr(receipt, { preference: 'auto' });
    const context: CertificateContext = {
      verificationStatus: 'verified',
      verifiedBitcoin: { height: 1, blockHash: 'a'.repeat(64), blockTimeUtc: '2020-01-01T00:00:00Z', sourcesAgreeing: sources },
    };
    const receiptSha256 = await sha256Hex(receipt);
    expect(() => createArchivalPrintSheet(symbols, receiptSha256, receipt.length, 'a4', undefined, context))
      .toThrow('Verified certificate requires validated block evidence');
  });

  it('retains a verified certificate when two different explorer hosts agree', async () => {
    const receipt = archivalReceiptFixture(200);
    const { symbols } = await encodeArchivalQr(receipt);
    const context: CertificateContext = {
      verificationStatus: 'verified',
      verifiedBitcoin: {
        height: 1, blockHash: 'a'.repeat(64), blockTimeUtc: '2020-01-01T00:00:00Z',
        sourcesAgreeing: ['mempool.space', 'blockstream.info'],
      },
    };
    const sheet = createArchivalPrintSheet(symbols, await sha256Hex(receipt), receipt.length, 'a4', undefined, context);
    expect(sheet.textContent).toContain('Verified against matching original file and independent Bitcoin header quorum');
    expect(sheet.textContent).toContain('Independent header sources agreeing: mempool.space, blockstream.info');
  });
});
