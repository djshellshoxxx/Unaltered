import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'unaltered-favicon-'));
beforeAll(() => {
  for (const path of ['src', 'scripts', 'package.json', 'LICENSE', 'tsconfig.json']) cpSync(path, join(dir, path), { recursive: true });
  symlinkSync(join(process.cwd(), 'node_modules'), join(dir, 'node_modules'), 'junction');
  const build = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: dir, encoding: 'utf8' });
  expect(build.status, build.stdout + build.stderr).toBe(0);
});
afterAll(() => { unlinkSync(join(dir, 'node_modules')); rmSync(dir, { recursive: true, force: true }); });
it('ships a local PNG favicon through the trusted builder without weakening image CSP', () => {
  const html = readFileSync(join(dir, 'dist/web/index.html'), 'utf8');
  expect(html).toContain('rel="icon" type="image/png" sizes="64x64" href="./favicon.png"');
  expect(html).toContain("img-src 'self' blob:");
  expect(html).not.toContain('img-src data:');
  const icon = readFileSync(join(dir, 'dist/web/favicon.png'));
  expect(icon.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(icon.readUInt32BE(16)).toBe(64);
  expect(icon.readUInt32BE(20)).toBe(64);
});
it('keeps standalone HTML self-contained and includes the embedded favicon bytes', () => {
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const html = readFileSync(join(dir, `dist/unaltered-${version}.html`), 'utf8');
  expect(html).not.toContain('href="./favicon.png"');
  expect(html).toContain('iVBORw0KGgo');
  expect(readFileSync('src/index.html', 'utf8')).not.toMatch(/<link\b/i);
});
