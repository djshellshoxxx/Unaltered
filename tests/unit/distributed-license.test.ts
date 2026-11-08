import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createScanner, LanguageVariant, ScriptTarget, SyntaxKind } from 'typescript';
import { afterAll, beforeAll, expect, it } from 'vitest';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const licenses = ['LICENSE', 'node_modules/@noble/hashes/LICENSE', 'node_modules/jsqr/LICENSE', 'src/vendor/qrcodegen-LICENSE.txt'].map((path) => ({
  path, notice: readFileSync(join(repo, path), 'utf8').replace(/\r\n?/g, '\n'),
}));
function requireNotices(value: string, where: string): void {
  for (const { path, notice } of licenses) expect(value.includes(notice), `${where} omits full ${path}`).toBe(true);
}
const { version } = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')) as { version: string };
const prefix = `unaltered-${version}`;
const cliName = `unaltered-cli-${version}.mjs`;
const dir = mkdtempSync(join(tmpdir(), 'unaltered-license-'));
const dist = join(dir, 'dist');
const text = (bytes: Buffer): string => bytes.toString('utf8').replace(/\r\n?/g, '\n');
beforeAll(() => {
  for (const path of ['src', 'scripts', 'package.json', 'LICENSE', 'tsconfig.json']) cpSync(join(repo, path), join(dir, path), { recursive: true });
  symlinkSync(join(repo, 'node_modules'), join(dir, 'node_modules'), 'junction');
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: dir, encoding: 'utf8' });
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
afterAll(() => { unlinkSync(join(dir, 'node_modules')); rmSync(dir, { recursive: true, force: true }); });

it('ships the complete noble notice in the Pages script and its actual embedded worker source, covered by SRI', () => {
  const main = readFileSync(join(dist, 'web/main.js'), 'utf8');
  requireNotices(main, 'Pages main.js');
  // Decode only the embedded source's string token, using the existing TypeScript scanner rather than executing it.
  const literal = /['"`]\/\*! Unaltered and dependency licenses/.exec(main);
  expect(literal, 'worker source has its own retained license banner').not.toBeNull();
  const scanner = createScanner(ScriptTarget.ES2022, false, LanguageVariant.Standard, main.slice(literal!.index));
  expect([SyntaxKind.StringLiteral, SyntaxKind.NoSubstitutionTemplateLiteral]).toContain(scanner.scan());
  requireNotices(scanner.getTokenValue(), 'embedded worker source');
  const index = readFileSync(join(dist, 'web/index.html'), 'utf8');
  const integrity = `sha384-${createHash('sha384').update(main).digest('base64')}`;
  expect(index).toContain(`integrity="${integrity}"`);
});

it('retains the full notice in standalone HTML with the exact inline script authorized by CSP', () => {
  const html = readFileSync(join(dist, `${prefix}.html`), 'utf8');
  requireNotices(html, 'standalone HTML');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  expect(script).toBeDefined();
  const csp = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1];
  expect(csp).toContain(`'sha256-${createHash('sha256').update(script!).digest('base64')}'`);
});

it('retains the full notice after the CLI shebang without breaking executable syntax', () => {
  const cli = readFileSync(join(dist, cliName), 'utf8');
  expect(cli.startsWith('#!/usr/bin/env node\n')).toBe(true);
  requireNotices(cli, 'standalone CLI');
  const result = spawnSync(process.execPath, ['--check', join(dist, cliName)], { encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
});

function archiveFiles(bytes: Buffer, tar: boolean): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  if (tar) {
    const raw = gunzipSync(bytes);
    for (let at = 0; at + 512 <= raw.length && raw[at] !== 0;) {
      const name = raw.toString('ascii', at, at + 100).replace(/\0[\s\S]*$/, '');
      const size = parseInt(raw.toString('ascii', at + 124, at + 136), 8);
      files.set(name.slice(prefix.length + 1), raw.subarray(at + 512, at + 512 + size));
      at += 512 + Math.ceil(size / 512) * 512;
    }
  } else {
    for (let at = 0; bytes.readUInt32LE(at) === 0x04034b50;) {
      const size = bytes.readUInt32LE(at + 18);
      const nameSize = bytes.readUInt16LE(at + 26);
      const start = at + 30 + nameSize + bytes.readUInt16LE(at + 28);
      const name = bytes.toString('ascii', at + 30, at + 30 + nameSize);
      files.set(name.slice(prefix.length + 1), bytes.subarray(start, start + size));
      at = start + size;
    }
  }
  return files;
}

it.each(['.zip', '-macos.zip', '-linux.tar.gz'])('retains the notice in every bundled software copy inside %s', (suffix) => {
  const files = archiveFiles(readFileSync(join(dist, prefix + suffix)), suffix.endsWith('.tar.gz'));
  for (const name of ['main.js', `${prefix}.html`, cliName]) requireNotices(text(files.get(name)!), suffix + '/' + name);
  expect(files.get('LICENSE')).toEqual(readFileSync(join(repo, 'LICENSE')));
  const readme = text(files.get('README.txt')!);
  expect(readme).toContain('verify-offline');
  expect(readme).toContain('Chain membership and height remain trusted inputs');
});
