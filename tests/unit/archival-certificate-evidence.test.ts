import { describe, expect, it } from 'vitest';
import { encodeArchivalQr } from '../../src/core/archive/qr-encode';
import { createArchivalPrintSheet, type CertificateContext } from '../../src/core/archive/qr-print';
import { archivalReceiptFixture } from '../helpers/archival-receipt';

const sha256Hex = async (bytes: Uint8Array): Promise<string> =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))), b => b.toString(16).padStart(2, '0')).join('');

describe('verified certificate evidence', () => {
  // The Verify flow requires a quorum of at least two independent explorers. One host counted twice is not a quorum,
  // so the print sheet must not print "Verified" for it even if a caller passes such evidence.
  it.each([
    [['mempool.space', 'mempool.space']],
    [['mempool.space', 'MEMPOOL.SPACE']],
    [['mempool.space', '']],
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
});
