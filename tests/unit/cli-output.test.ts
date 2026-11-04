import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

const controls = (s: string): string[] => [...s].filter((ch) => ch.charCodeAt(0) < 0x20 || (ch.charCodeAt(0) >= 0x7f && ch.charCodeAt(0) <= 0x9f));
const REFUSED = { code: 1, out: '', err: 'error: the file name contains control characters\n' };

async function hashOut(name: string): Promise<{ dir: string; code: number; out: string; err: string }> {
  const dir = tmp();
  writeFileSync(join(dir, name), 'abc');
  const o = { out: '', err: '' };
  const code = await run(['hash', join(dir, name)], { out: (s) => void (o.out += s), err: (s) => void (o.err += s) });
  return { dir, code, ...o };
}

// A file name is attacker-controlled when a shell glob expands it. Printed raw, a newline adds a forged
// "<hash>  <name>" line to a checksum list and a carriage return or escape sequence can overwrite the real
// fingerprint on the terminal. GNU sha256sum escapes `\`, `\n` and `\r` and prefixes the line with `\`; its `-c`
// reads back only those three escapes and prints every other character as is. A line it cannot read is only a
// warning, so `sha256sum -c` would skip that file, even a tampered one, and still exit 0.
// The leading-backslash escape form is GNU coreutils syntax. Other sha256sum implementations (macOS, and the uutils
// coreutils some Linux images now ship) do not read it, so the interop checks run only against GNU sha256sum.
const sha256sumVersion = spawnSync('sha256sum', ['--version'], { encoding: 'utf8' });
const gnu = sha256sumVersion.status === 0 && /GNU coreutils/.test(sha256sumVersion.stdout ?? '');

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

  // No escape that `sha256sum -c` reads exists for these, and printed raw they could rewrite the terminal line.
  it('refuses a name with terminal escape sequences instead of printing a line sha256sum -c skips', async () => {
    const r = await hashOut('e\x1b[2K\x1b[1Gtab\there\x7f\u009b');
    expect({ code: r.code, out: r.out, err: r.err }).toEqual(REFUSED);
    expect(controls(r.out + r.err.slice(0, -1))).toEqual([]);
  });

  it('refuses every other C0 control, DEL and C1 control, before printing anything', async () => {
    // Backspace can move the cursor back over the real fingerprint; ESC and C1 CSI start escape sequences.
    const names = ['bs\b\b\b' + 'f'.repeat(64), 'esc\x1b]0;t\x07', 'soh\x01', 'vt\x0b', 'ff\x0c', 'us\x1f', 'del\x7f', 'pad\u0080', 'csi\u009b2K', 'apc\u009f'];
    for (const name of names) {
      const r = await hashOut(name);
      expect({ code: r.code, out: r.out, err: r.err }, JSON.stringify(name)).toEqual(REFUSED);
    }
    // Refused before the file is opened, so a missing file gets the same answer and nothing is read.
    const o = { out: '', err: '' };
    const code = await run(['hash', join(tmp(), 'missing\x1b[2K')], { out: (s) => void (o.out += s), err: (s) => void (o.err += s) });
    expect({ code, ...o }).toEqual(REFUSED);
  });

  it('prints a TAB in a name as is, like sha256sum', async () => {
    const r = await hashOut('tab\there');
    expect({ code: r.code, out: r.out, err: r.err }).toEqual({ code: 0, out: `${ABC}  ${r.dir}/tab\there\n`, err: '' });
  });

  it.runIf(gnu)('prints only lines GNU sha256sum -c checks, so a tampered file fails the check (skipped where GNU sha256sum is missing)', async () => {
    const dir = tmp();
    const names = ['plain.txt', 'tab\there', `a\n${'0'.repeat(64)}  forged`, 'cr\rhere', 'back\\slash', 'back\\slash\nand break'];
    let list = '';
    for (const name of names) {
      writeFileSync(join(dir, name), 'abc');
      const o = { out: '', err: '' };
      expect(await run(['hash', join(dir, name)], { out: (s) => void (o.out += s), err: (s) => void (o.err += s) })).toBe(0);
      list += o.out;
    }
    writeFileSync(join(dir, 'list'), list);
    const check = (...opts: string[]) => spawnSync('sha256sum', [...opts, '-c', join(dir, 'list')], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } });
    // --strict: a line sha256sum cannot read fails the check, so every line must be read back and match its file.
    const clean = check('--strict');
    expect({ status: clean.status, stderr: clean.stderr, ok: clean.stdout.split('\n').filter((l) => l.endsWith(': OK')).length }).toEqual({ status: 0, stderr: '', ok: names.length });
    // As a user runs it, without --strict: the tampered file must be checked and fail, not skipped with exit 0.
    writeFileSync(join(dir, 'tab\there'), 'tampered');
    const tampered = check();
    expect({ status: tampered.status, stderr: tampered.stderr }).toEqual({ status: 1, stderr: 'sha256sum: WARNING: 1 computed checksum did NOT match\n' });
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

// Windows paths use `\` as the separator (D:\Photos\2026\photo.jpg). An ordinary path must still print as
// "<fingerprint>  <path>", so a script that reads the first 64 characters gets the fingerprint. Without a leading `\`,
// `sha256sum -c` reads the name literally, so the separators need no escaping.
describe('cli hash output for a path with backslashes', () => {
  it('prints the path unchanged after the fingerprint, as on Windows', async () => {
    // On Windows these are directory separators; elsewhere they are part of one file name.
    const f = join(tmp(), 'win\\like\\a.txt');
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, 'abc');
    const o = { out: '', err: '' };
    const code = await run(['hash', f], { out: (s) => void (o.out += s), err: (s) => void (o.err += s) });
    expect({ code, ...o }).toEqual({ code: 0, out: `${ABC}  ${f}\n`, err: '' });
    expect(o.out.slice(0, 64)).toBe(ABC);
  });
});
