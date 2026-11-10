// CLI parity with the browser's receipt inspection, JSON report export, batch verification and evidence bundle.
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '../../src/cli/run';
import { serializeProof } from '../../src/core/ots/codec';
import type { DetachedProof } from '../../src/core/ots/types';
import { explorer, makeHeader, routerFetch } from '../helpers/chain';

const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const sha = (data: string | Uint8Array): Uint8Array => new Uint8Array(createHash('sha256').update(data).digest());
const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const ALICE = 'https://alice.btc.calendar.opentimestamps.org';

const pendingProof = (content: string): Uint8Array => {
  const digest = sha(content);
  return serializeProof({ digest, root: { msg: digest, attestations: [{ kind: 'pending', uri: ALICE }], children: [] } });
};
const bitcoinProof = (content: string, height = 42): Uint8Array => {
  const digest = sha(content);
  return serializeProof({ digest, root: { msg: digest, attestations: [{ kind: 'bitcoin', height }], children: [] } } as DetachedProof);
};

const dirs: string[] = [];
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'unaltered-cli-parity-'));
  dirs.push(d);
  return d;
};
const capture = () => {
  const o = { out: '', err: '' };
  return { o, io: { out: (s: string) => void (o.out += s), err: (s: string) => void (o.err += s) } };
};

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchSpy = vi.fn(() => { throw new Error('network forbidden in this test'); });
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Two agreeing explorers serving a header whose Merkle root is the given commitment. */
function stubExplorers(commitment: Uint8Array, height = 42): { hashHex: string } {
  const header = makeHeader(commitment, 1_700_000_000);
  vi.stubGlobal('fetch', routerFetch(explorer('mempool.space', { [height]: header.raw }),
    explorer('blockstream.info', { [height]: header.raw })));
  return { hashHex: header.hashHex };
}

describe('cli inspect', () => {
  it('summarises a pending receipt offline without claiming verification', async () => {
    const d = tmp();
    const ots = join(d, 'a.txt.ots');
    const bytes = pendingProof('abc');
    writeFileSync(ots, bytes);
    const { o, io } = capture();
    expect(await run(['inspect', ots], io)).toBe(0);
    expect(o.err).toBe('');
    expect(o.out).toContain(`receipt sha-256: ${hexOf(sha(bytes)).match(/.{8}/g)!.join(' ')}`);
    expect(o.out).toContain(`receipt size: ${bytes.length} bytes`);
    expect(o.out).toContain(`file sha-256: ${ABC.match(/.{8}/g)!.join(' ')}`);
    expect(o.out).toContain('status: PENDING');
    expect(o.out).toContain(`pending at: ${ALICE}`);
    expect(o.out).toContain('not verified');
    expect(o.out).not.toContain('VERIFIED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports Bitcoin attestation heights as unverified claims in JSON', async () => {
    const d = tmp();
    const ots = join(d, 'b.ots');
    const bytes = bitcoinProof('abc', 358391);
    writeFileSync(ots, bytes);
    const { o, io } = capture();
    expect(await run(['inspect', '--json', ots], io)).toBe(0);
    const report = JSON.parse(o.out);
    expect(report).toEqual({
      format: 'UNALTERED-RECEIPT-INSPECTION/1',
      receiptSha256: hexOf(sha(bytes)),
      receiptBytes: bytes.length,
      fileSha256: ABC,
      status: 'BITCOIN_ATTESTATION_UNVERIFIED',
      bitcoinHeights: [358391],
      pendingCalendars: [],
      verification: 'NOT_PERFORMED',
      warning: expect.stringContaining('does not check the original file or the Bitcoin blockchain'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects an invalid receipt with exit 4 and no stdout', async () => {
    const d = tmp();
    const ots = join(d, 'bad.ots');
    writeFileSync(ots, 'not a receipt');
    const { o, io } = capture();
    expect(await run(['inspect', ots], io)).toBe(4);
    expect(o.out).toBe('');
    expect(o.err).toMatch(/^error: /);
  });

  it('prints usage for missing or extra arguments', async () => {
    for (const argv of [['inspect'], ['inspect', 'a', 'b'], ['inspect', '--json'], ['inspect', '--xml', 'a.ots']]) {
      const { o, io } = capture();
      expect(await run(argv, io), argv.join(' ')).toBe(1);
      expect(o.err).toContain('inspect');
    }
  });
});

describe('cli verify --json', () => {
  it('prints the browser-compatible verification report for a pending receipt with exit 2', async () => {
    const d = tmp();
    const file = join(d, 'a.txt');
    writeFileSync(file, 'abc');
    writeFileSync(`${file}.ots`, pendingProof('abc'));
    const { o, io } = capture();
    expect(await run(['verify', '--json', file], io)).toBe(2);
    const report = JSON.parse(o.out);
    expect(report.format).toBe('UNALTERED-VERIFICATION-REPORT/1');
    expect(report.fileSha256).toBe(ABC);
    expect(report.status).toBe('PENDING');
    expect(report.bitcoin).toBeNull();
    expect(report.pendingCalendars).toEqual([ALICE]);
  });

  it('includes quorum-agreed block evidence when verified', async () => {
    const d = tmp();
    const file = join(d, 'a.txt');
    writeFileSync(file, 'abc');
    writeFileSync(join(d, 'r.ots'), bitcoinProof('abc'));
    const { hashHex } = stubExplorers(sha('abc'));
    const { o, io } = capture();
    expect(await run(['verify', '--json', file, join(d, 'r.ots')], io)).toBe(0);
    const report = JSON.parse(o.out);
    expect(report.status).toBe('VERIFIED');
    expect(report.bitcoin).toEqual({ height: 42, blockHash: hashHex, blockTimeUtc: '2023-11-14T22:13:20Z',
      sourcesAgreeing: expect.arrayContaining(['mempool.space', 'blockstream.info']) });
  });

  it('accepts -- to end options', async () => {
    const d = tmp();
    const file = join(d, 'a.txt');
    writeFileSync(file, 'abc');
    writeFileSync(`${file}.ots`, pendingProof('abc'));
    const plain = capture();
    expect(await run(['verify', '--', file], plain.io)).toBe(2);
    expect(plain.o.out).toContain('result: PENDING');
    const json = capture();
    expect(await run(['verify', '--json', '--', file], json.io)).toBe(2);
    expect(JSON.parse(json.o.out).status).toBe('PENDING');
  });

  it('keeps the plain-text output without the flag', async () => {
    const d = tmp();
    const file = join(d, 'a.txt');
    writeFileSync(file, 'abc');
    writeFileSync(`${file}.ots`, pendingProof('abc'));
    const { o, io } = capture();
    expect(await run(['verify', file], io)).toBe(2);
    expect(o.out).toContain('result: PENDING');
    expect(() => JSON.parse(o.out)).toThrow();
  });
});

describe('cli batch', () => {
  it('verifies each file against <file>.ots independently and reports every result', async () => {
    const d = tmp();
    const ok = join(d, 'ok.txt');
    const pending = join(d, 'pending.txt');
    writeFileSync(ok, 'abc');
    writeFileSync(`${ok}.ots`, bitcoinProof('abc'));
    writeFileSync(pending, 'xyz');
    writeFileSync(`${pending}.ots`, pendingProof('xyz'));
    stubExplorers(sha('abc'));
    const { o, io } = capture();
    expect(await run(['batch', ok, pending], io)).toBe(2);
    expect(o.err).toBe('');
    expect(o.out).toContain(`${ok}: VERIFIED`);
    expect(o.out).toContain('bitcoin block 42');
    expect(o.out).toContain(`${pending}: PENDING`);
    expect(o.out).toContain('summary: 1 verified, 1 pending, 0 not verified');
  });

  it('exits 0 only when every item is verified', async () => {
    const d = tmp();
    const a = join(d, 'a.txt');
    const b = join(d, 'b.txt');
    for (const f of [a, b]) {
      writeFileSync(f, 'abc');
      writeFileSync(`${f}.ots`, bitcoinProof('abc'));
    }
    stubExplorers(sha('abc'));
    const { o, io } = capture();
    expect(await run(['batch', a, b], io)).toBe(0);
    expect(o.out).toContain('summary: 2 verified, 0 pending, 0 not verified');
  });

  it('exits 8 when any item fails, without hiding the other results or leaking lower-layer messages', async () => {
    const d = tmp();
    const good = join(d, 'good.txt');
    const changed = join(d, 'changed.txt');
    const missing = join(d, 'missing.txt');
    writeFileSync(good, 'xyz');
    writeFileSync(`${good}.ots`, pendingProof('xyz'));
    writeFileSync(changed, 'tampered');
    writeFileSync(`${changed}.ots`, pendingProof('original'));
    writeFileSync(missing, 'abc');
    const { o, io } = capture();
    expect(await run(['batch', '--json', good, changed, missing], io)).toBe(8);
    const report = JSON.parse(o.out);
    expect(report.format).toBe('UNALTERED-BATCH-VERIFICATION/1');
    expect(report.items.map((i: { status: string }) => i.status)).toEqual(['PENDING', 'NO_MATCH_FILE', 'ERROR']);
    expect(report.items[0].file).toBe(good);
    expect(report.items[0].receipt).toBe(`${good}.ots`);
    expect(report.items[0].report.format).toBe('UNALTERED-VERIFICATION-REPORT/1');
    expect(report.items[0].report.fileSha256).toBe(hexOf(sha('xyz')));
    expect(report.items[2].error).toBe('file not found');
    expect(report.items[2].report).toBeUndefined();
    expect(o.out).not.toContain('ENOENT');
    expect(report.summary).toEqual({ verified: 0, pending: 1, notVerified: 2 });
  });

  it('refuses duplicate, too many, or control-character paths before reading anything', async () => {
    const d = tmp();
    const a = join(d, 'a.txt');
    writeFileSync(a, 'abc');
    writeFileSync(`${a}.ots`, pendingProof('abc'));
    const cases: [string[], string][] = [
      [['batch'], 'batch'],
      [['batch', a, a], 'error: duplicate file paths are ambiguous\n'],
      [['batch', ...Array.from({ length: 51 }, (_, i) => `${a}${i}`)], 'error: choose between 1 and 50 files\n'],
      [['batch', a, join(d, 'x\x1b[2K')], 'error: the file name contains control characters\n'],
    ];
    for (const [argv, err] of cases) {
      const { o, io } = capture();
      expect(await run(argv, io), argv.length.toString()).toBe(1);
      expect(o.out).toBe('');
      expect(o.err).toContain(err);
    }
  });
});

describe('cli evidence', () => {
  it('writes the browser evidence ZIP and refuses to overwrite an existing file', async () => {
    const d = tmp();
    const file = join(d, 'a.txt');
    const ots = join(d, 'a.txt.ots');
    const out = join(d, 'bundle.zip');
    const receipt = pendingProof('abc');
    writeFileSync(file, 'abc');
    writeFileSync(ots, receipt);
    const { o, io } = capture();
    expect(await run(['evidence', file, ots, out], io)).toBe(0);
    expect(o.err).toBe('');
    const zip = readFileSync(out);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const text = zip.toString('latin1');
    expect(text).toContain('UNALTERED-EVIDENCE-BUNDLE/1');
    expect(text).toContain(ABC);
    expect(text).toContain(hexOf(sha(receipt)));
    expect(o.out).toContain('verification: NOT_PERFORMED');
    expect(fetchSpy).not.toHaveBeenCalled();

    const again = capture();
    expect(await run(['evidence', file, ots, out], again.io)).toBe(1);
    expect(again.o.err).toBe('error: the output file already exists\n');
    expect(readFileSync(out).equals(zip)).toBe(true);
  });

  it('refuses an invalid receipt (4) or a receipt for another file (3) without writing', async () => {
    const d = tmp();
    const file = join(d, 'a.txt');
    writeFileSync(file, 'abc');
    writeFileSync(join(d, 'bad.ots'), 'garbage');
    writeFileSync(join(d, 'other.ots'), pendingProof('other'));
    for (const [receipt, code] of [['bad.ots', 4], ['other.ots', 3]] as const) {
      const out = join(d, `${receipt}.zip`);
      const { o, io } = capture();
      expect(await run(['evidence', file, join(d, receipt), out], io)).toBe(code);
      expect(o.out).toBe('');
      expect(existsSync(out)).toBe(false);
    }
  });

  it('refuses inputs above the 16 MiB bundle limit without writing', async () => {
    const d = tmp();
    const file = join(d, 'big.bin');
    const big = Buffer.alloc(16 * 1024 * 1024, 7);
    writeFileSync(file, big);
    writeFileSync(join(d, 'big.ots'), serializeProof({ digest: sha(big), root: { msg: sha(big), children: [],
      attestations: [{ kind: 'pending', uri: ALICE }] } }));
    const out = join(d, 'big.zip');
    const { o, io } = capture();
    expect(await run(['evidence', file, join(d, 'big.ots'), out], io)).toBe(1);
    expect(o.err).toBe('error: evidence inputs exceed 16 MiB combined\n');
    expect(existsSync(out)).toBe(false);
  });
});
