import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';

// A failed write (full disk, closed pipe) must end with a generic message and exit 1, not an uncaught stream error
// whose stack trace names files and install paths (SR-8). /dev/full fails every write with ENOSPC.
describe('cli output write failures', () => {
  it.skipIf(!existsSync('/dev/full'))('reports a failed stdout write generically with exit 1 (skipped where /dev/full is missing)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'unaltered-cli-io-'));
    const full = openSync('/dev/full', 'w');
    try {
      const cli = join(dir, 'cli.mjs');
      await build({ entryPoints: ['src/cli/main.ts'], outfile: cli, bundle: true, platform: 'node', format: 'esm' });
      const file = join(dir, 'a.txt');
      writeFileSync(file, 'abc');
      const result = await new Promise<{ code: number | null; signal: string | null; err: string }>((resolve, reject) => {
        const child = spawn(process.execPath, [cli, 'hash', file], { stdio: ['ignore', full, 'pipe'], timeout: 5000, killSignal: 'SIGKILL' });
        let err = '';
        child.stderr!.on('data', (data: Buffer) => { err += data.toString(); });
        child.on('error', reject);
        child.on('close', (code, signal) => resolve({ code, signal, err }));
      });
      expect(result).toEqual({ code: 1, signal: null, err: 'error: could not write the output\n' });
    } finally {
      closeSync(full);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
