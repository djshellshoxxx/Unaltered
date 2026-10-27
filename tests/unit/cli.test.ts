import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readReceipt, run } from '../../src/cli/run';
import { LIMITS } from '../../src/core/ots/types';

const io = () => {
  const o = { out: '', err: '' };
  return { o, io: { out: (s: string) => void (o.out += s), err: (s: string) => void (o.err += s) } };
};
const tmp = () => mkdtempSync(join(tmpdir(), 'unaltered-cli-'));

describe('cli', () => {
  it('hashes a file (known vector for "abc")', async () => {
    const f = join(tmp(), 'a.txt');
    writeFileSync(f, 'abc');
    const { o, io: i } = io();
    expect(await run(['hash', f], i)).toBe(0);
    expect(o.out.startsWith('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')).toBe(true);
  });
  it('prints usage and exits 1 on bad arguments', async () => {
    const { o, io: i } = io();
    expect(await run(['nope'], i)).toBe(1);
    expect(o.err).toContain('verify <file>');
  });
  it('reports a missing file without leaking the path', async () => {
    const { o, io: i } = io();
    expect(await run(['hash', '/definitely/not/here'], i)).toBe(1);
    expect(o.err).toBe('error: file not found\n');
  });
  it('reads at most one byte past the receipt limit, so the core rejects it without loading the whole file', async () => {
    const f = join(tmp(), 'big.ots');
    writeFileSync(f, Buffer.alloc(LIMITS.maxInputBytes * 3, 1));
    expect((await readReceipt(f)).length).toBe(LIMITS.maxInputBytes + 1);
    const exact = join(tmp(), 'exact.ots');
    writeFileSync(exact, Buffer.alloc(LIMITS.maxInputBytes, 2));
    expect(await readReceipt(exact)).toEqual(new Uint8Array(LIMITS.maxInputBytes).fill(2));
  });
  it('reports an over-limit receipt as invalid (exit 4) with the same message as the browser', async () => {
    const d = tmp();
    writeFileSync(join(d, 'a.txt'), 'abc');
    writeFileSync(join(d, 'a.txt.ots'), Buffer.alloc(LIMITS.maxInputBytes + 1));
    const { o, io: i } = io();
    expect(await run(['verify', join(d, 'a.txt')], i)).toBe(4);
    expect(o.out).toContain('INVALID_PROOF');
    expect(o.out).toContain('The receipt file is too large.');
  });
  it('reports a missing receipt before hashing the file', async () => {
    // A directory cannot be hashed; if the file were hashed first this would be a generic error instead.
    const d = tmp();
    const { o, io: i } = io();
    expect(await run(['verify', d, join(d, 'missing.ots')], i)).toBe(1);
    expect(o.err).toBe('error: file not found\n');
  });
  it('rejects a garbage receipt as invalid (exit 4)', async () => {
    const d = tmp();
    writeFileSync(join(d, 'a.txt'), 'abc');
    writeFileSync(join(d, 'a.txt.ots'), 'not a receipt');
    const { o, io: i } = io();
    expect(await run(['verify', join(d, 'a.txt')], i)).toBe(4);
    expect(o.out).toContain('INVALID_PROOF');
  });
});
