import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { encodeReceiptFrames, recoverReceiptFrames } from '../../src/core/archive/frames';

/** TypeScript side of the second golden vector set. Python builds these vectors from the protocol text
 * (tests/archival/make_golden_v2.py); nothing here is generated from TypeScript output. No browser is launched. */
interface Vectors {
  accept: { name: string; max_frame_bytes: number; receipt_hex: string; frames_hex: string[] }[];
  reject: { name: string; frames_hex: string[] }[];
}
const vectors = JSON.parse(readFileSync('tests/archival/golden-v2.json', 'utf8')) as Vectors;
const bytes = (hex: string): Uint8Array => Uint8Array.from(Buffer.from(hex, 'hex'));

test('golden-v2 set is present and non-trivial', () => {
  expect(vectors.accept.length).toBeGreaterThanOrEqual(7);
  expect(vectors.reject.length).toBeGreaterThanOrEqual(18);
});

for (const vector of vectors.accept) {
  test(`golden-v2 accept ${vector.name}: TypeScript encodes the Python frames byte for byte and recovers the receipt`, async () => {
    const receipt = bytes(vector.receipt_hex);
    const expected = vector.frames_hex.map(bytes);
    expect(await encodeReceiptFrames(receipt, vector.max_frame_bytes)).toEqual(expected);
    expect(await recoverReceiptFrames([...expected].reverse())).toEqual(receipt);
    expect(await recoverReceiptFrames([...expected, expected[0]!])).toEqual(receipt);
  });
}

for (const vector of vectors.reject) {
  test(`golden-v2 reject ${vector.name}: TypeScript refuses the frame set`, async () => {
    await expect(recoverReceiptFrames(vector.frames_hex.map(bytes))).rejects.toThrow(/Invalid archival QR frame/);
  });
}
