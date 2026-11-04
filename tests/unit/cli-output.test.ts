import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';

const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const dirs: string[] = [];
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'unaltered-cli-out-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function hashOut(name: string): Promise<{ dir: string; code: number; out: string; err: string }> {
  const dir = tmp();
  writeFileSync(join(dir, name), 'abc');
  const o = { out: '', err: '' };
  const code = await run(['hash', join(dir, name)], { out: (s) => void (o.out += s), err: (s) => void (o.err += s) });
  return { dir, code, ...o };
}

// A file name is attacker-controlled when a shell glob expands it. Printed raw, a newline adds a forged
// "<hash>  <name>" line to a checksum list and a carriage return or escape sequence can overwrite the real
// fingerprint on the terminal. GNU sha256sum escapes `\`, `\n` and `\r` and prefixes the line with `\`.
describe.runIf(process.platform !== 'win32')('cli hash output with hostile file names', () => {
  it('escapes a newline so the name cannot add a forged checksum line', async () => {
    const r = await hashOut(`a\n${'0'.repeat(64)}  forged`);
    expect(r.code).toBe(0);
    expect(r.out).toBe(`\\${ABC}  ${r.dir}/a\\n${'0'.repeat(64)}  forged\n`);
    expect(r.out.split('\n')).toHaveLength(2);
  });

  it('escapes a carriage return and backslashes like sha256sum', async () => {
    const r = await hashOut(`x\r${'f'.repeat(64)}  x\\y`);
    expect(r.out).toBe(`\\${ABC}  ${r.dir}/x\\r${'f'.repeat(64)}  x\\\\y\n`);
  });

  it('escapes other control characters such as terminal escape sequences', async () => {
    const r = await hashOut('e\x1b[2K\x1b[1Gtab\there\x7f\u009b');
    expect(r.out).toBe(`\\${ABC}  ${r.dir}/e\\x1b[2K\\x1b[1Gtab\\x09here\\x7f\\x9b\n`);
    const controls = [...r.out.slice(0, -1)].filter((ch) => ch.charCodeAt(0) < 0x20 || (ch.charCodeAt(0) >= 0x7f && ch.charCodeAt(0) <= 0x9f));
    expect(controls).toEqual([]);
  });

  it('prints an ordinary name unchanged', async () => {
    const r = await hashOut('plain name.txt');
    expect(r.out).toBe(`${ABC}  ${r.dir}/plain name.txt\n`);
  });

  // Escaping is only needed when a control character could forge a line or rewrite the terminal. A backslash alone
  // (a Windows path separator, or a legal POSIX name byte) stays literal, as before; `sha256sum -c` reads an
  // unescaped line literally, so the output still checks.
  it('prints a name whose only special character is a backslash unchanged', async () => {
    const r = await hashOut('back\\slash.txt');
    expect(r.out).toBe(`${ABC}  ${r.dir}/back\\slash.txt\n`);
  });

  // The leading-backslash escape form is GNU coreutils syntax; other sha256sum tools (e.g. on macOS) do not read it.
  const sha256sum = spawnSync('sha256sum', ['--version'], { encoding: 'utf8' });
  const gnu = sha256sum.status === 0 && /GNU coreutils/.test(sha256sum.stdout ?? '');
  it.runIf(gnu)('produces lines that GNU sha256sum -c accepts (skipped where GNU sha256sum is missing)', async () => {
    for (const name of ['back\\slash.txt', `nl\nname`, 'cr\rname\\x']) {
      const r = await hashOut(name);
      const list = join(r.dir, 'SUMS');
      writeFileSync(list, r.out);
      const check = spawnSync('sha256sum', ['-c', list], { encoding: 'utf8', timeout: 5000 });
      expect({ name, status: check.status, stderr: check.stderr }).toEqual({ name, status: 0, stderr: '' });
    }
  });
});

// Windows paths always contain backslashes and can never contain control characters, so they must print verbatim.
describe('cli hash output on paths with separators', () => {
  it('does not escape the backslashes of a Windows-style path', async () => {
    const dir = tmp();
    const f = join(dir, 'abc.txt');
    writeFileSync(f, 'abc');
    const o = { out: '', err: '' };
    expect(await run(['hash', f], { out: (s) => void (o.out += s), err: (s) => void (o.err += s) })).toBe(0);
    expect(o.out).toBe(`${ABC}  ${f}\n`);
  });
});
