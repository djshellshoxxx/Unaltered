import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../scripts/compare-pages-builds.mjs', import.meta.url));
const digest = (data: string) => createHash('sha256').update(data).digest('hex');
let root: string, left: string, right: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pages-compare-'));
  left = join(root, 'first');
  right = join(root, 'second');
  for (const dir of [left, right]) {
    mkdirSync(join(dir, 'assets'), { recursive: true });
    writeFileSync(join(dir, 'assets', 'main.js'), 'js');
    writeFileSync(join(dir, 'index.html'), 'html');
  }
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const compare = (a = left, b = right) => spawnSync(process.execPath, [script, a, b], { encoding: 'utf8' });

it('prints one SHA-256 record per file with portable relative paths', () => {
  const result = compare();
  expect(result.status).toBe(0);
  expect(result.stdout).toBe(`${digest('js')}  assets/main.js\n${digest('html')}  index.html\n`);
});

it('fails when bytes differ and emits no successful checksum records', () => {
  writeFileSync(join(right, 'assets', 'main.js'), 'changed');
  const result = compare();
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
});

it('rejects linked directories at the root and within both artifacts', () => {
  const linked = join(root, 'linked');
  symlinkSync(left, linked, 'junction');
  // A trailing separator or dot makes lstat follow a directory symlink on POSIX.
  for (const path of [linked, `${linked}/`, `${linked}/.`, `${linked}/./`]) {
    expect(compare(path, right).status, path).toBe(1);
    expect(compare(right, path).status, path).toBe(1);
  }
  const external = join(root, 'external');
  mkdirSync(external);
  writeFileSync(join(external, 'shared.txt'), 'shared');
  for (const dir of [left, right]) symlinkSync(external, join(dir, 'shared'), 'junction');
  expect(compare().status).toBe(1);
});
