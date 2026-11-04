import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChunkSource } from '../../src/core/hash/stream';

// Runs a callback after the first chunk of a CLI hash is read, so a concurrent writer can be simulated deterministically.
const hook = vi.hoisted(() => ({ afterFirstChunk: null as null | (() => void) }));
vi.mock('../../src/core/hash/stream', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/core/hash/stream')>();
  return {
    ...real,
    hashSource: (src: ChunkSource, opts?: Parameters<typeof real.hashSource>[1]) => {
      let reads = 0;
      const wrapped: ChunkSource = {
        size: src.size,
        slice: (start, end) => ({
          arrayBuffer: async () => {
            const buf = await src.slice(start, end).arrayBuffer();
            if (reads++ === 0) hook.afterFirstChunk?.();
            return buf;
          },
        }),
      };
      return real.hashSource(wrapped, opts);
    },
  };
});

const { run } = await import('../../src/cli/run');
const { CHUNK_SIZE } = await import('../../src/core/hash/stream');

const dirs: string[] = [];
afterEach(() => {
  hook.afterFirstChunk = null;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

describe('cli hash of a file rewritten while it is read', () => {
  it('refuses to print a fingerprint mixed from old and new content', async () => {
    const d = mkdtempSync(join(tmpdir(), 'unaltered-cli-race-'));
    dirs.push(d);
    const f = join(d, 'evidence.bin');
    const before = new Uint8Array(CHUNK_SIZE + 1024).fill(1);
    const after = new Uint8Array(before.length).fill(2);
    writeFileSync(f, before);
    // An old mtime makes the rewrite visible even on file systems with coarse timestamps.
    utimesSync(f, 946684800, 946684800);
    // Same size, rewritten in place: the size and end-of-file checks cannot see it.
    hook.afterFirstChunk = () => writeFileSync(f, after, { flag: 'r+' });
    const o = { out: '', err: '' };
    const code = await run(['hash', f], { out: (s) => void (o.out += s), err: (s) => void (o.err += s) });
    const printed = o.out.slice(0, 64);
    expect({ code, out: o.out, err: o.err, torn: printed !== '' && printed !== sha(before) && printed !== sha(after) }).toEqual({
      code: 1,
      out: '',
      err: 'error: the file changed while reading\n',
      torn: false,
    });
  });

  it('still hashes a multi-chunk file nobody writes to', async () => {
    const d = mkdtempSync(join(tmpdir(), 'unaltered-cli-race-'));
    dirs.push(d);
    const f = join(d, 'steady.bin');
    const bytes = new Uint8Array(CHUNK_SIZE + 1024).fill(3);
    writeFileSync(f, bytes);
    const o = { out: '', err: '' };
    expect(await run(['hash', f], { out: (s) => void (o.out += s), err: (s) => void (o.err += s) })).toBe(0);
    expect(o.out).toBe(`${sha(bytes)}  ${f}\n`);
  });
});
