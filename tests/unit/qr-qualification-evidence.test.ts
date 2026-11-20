import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../scripts/check-qr-qualification.mjs', import.meta.url));
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const cases = [
  ...[200, 3000, 12000].flatMap(fixture => ['L', 'M', 'Q', 'H'].map(level => ({ fixture, level, paper: 'a4' }))),
  { fixture: 3000, level: 'auto', paper: 'a4' }, { fixture: 3000, level: 'auto', paper: 'letter' },
  { fixture: 12000, level: 'H', paper: 'letter' },
];
let directory: string;
const key = (c: typeof cases[number]) => `${c.fixture}-${c.level}-${c.paper}`;
const first = () => join(directory, key(cases[0]!));
const check = () => spawnSync(process.execPath, [script, directory], { encoding: 'utf8' });
const change = (edit: (value: any) => void) => {
  const file = join(first(), 'zxing-report.json');
  const report = JSON.parse(readFileSync(file, 'utf8'));
  edit(report);
  writeFileSync(file, JSON.stringify(report));
};

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'qr-evidence-'));
  for (const c of cases) {
    const dir = join(directory, key(c)); mkdirSync(dir);
    const size = c.fixture === 200 ? 325 : c.fixture === 3000 ? 3145 : 12217;
    const original = Buffer.alloc(size, 42), pdf = Buffer.from(`%PDF-1.7\n${key(c)}`);
    writeFileSync(join(dir, 'original.ots'), original); writeFileSync(join(dir, 'certificate.pdf'), pdf);
    const total = Math.ceil(size / 1000);
    const labels = Array.from({ length: total }, (_, index) => ({
      index, total, version: 40, level: c.level === 'auto' ? 'M' : c.level, mask: index % 8,
      frameBytes: Math.min(1000, size - index * 1000) + 80,
    }));
    const perPage = [Math.min(2, total)];
    for (let rest = total - perPage[0]!; rest > 0; rest -= 4) perPage.push(Math.min(4, rest));
    perPage.push(0);
    writeFileSync(join(dir, 'zxing-report.json'), JSON.stringify({
      fixture: c.fixture, size, level: c.level, paper: c.paper, status: 0,
      printed: { pages: perPage.length, labels },
      value: {
        decoder: 'zxing-cpp 3.1.1', dpi: 150, recovered: true, identical: true,
        original_sha256: hash(original), recovered_sha256: hash(original), pdf_sha256: hash(pdf),
        pages: perPage.length, symbols_per_page: perPage,
        symbols: labels.map(l => ({ index: l.index, version: l.version, ec: l.level, mask: l.mask, bytes: l.frameBytes })),
      },
    }));
  }
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

it('accepts all 15 expected certificates with file-bound independent recovery evidence', () => {
  const result = check();
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  expect(result.stdout).toContain('15');
});

it('rejects a missing certificate even when every remaining case succeeded', () => {
  rmSync(first(), { recursive: true }); expect(check().status).toBe(1);
});

it('rejects 15 reports if one expected case is replaced by a different case', () => {
  renameSync(first(), join(directory, '200-auto-letter')); expect(check().status).toBe(1);
});

it('rejects extra cases instead of accepting only a successful subset', () => {
  mkdirSync(join(directory, 'unexpected')); expect(check().status).toBe(1);
});

it('rejects malformed evidence', () => {
  writeFileSync(join(first(), 'zxing-report.json'), '{'); expect(check().status).toBe(1);
});

it.each([
  ['nonzero decoder exit', (r: any) => { r.status = 1; }],
  ['skipped recovery', (r: any) => { r.value.recovered = false; }],
  ['different recovered bytes', (r: any) => { r.value.identical = false; }],
  ['missing decoder provenance', (r: any) => { delete r.value.decoder; }],
  ['unexpected decoder version', (r: any) => { r.value.decoder = 'zxing-cpp 0.0.0'; }],
  ['missing hash', (r: any) => { delete r.value.recovered_sha256; }],
  ['conflicting hashes', (r: any) => { r.value.recovered_sha256 = '0'.repeat(64); }],
  ['missing PDF hash', (r: any) => { delete r.value.pdf_sha256; }],
  ['wrong fixture size', (r: any) => { r.size++; }],
  ['wrong correction level', (r: any) => { r.level = 'auto'; }],
  ['wrong paper', (r: any) => { r.paper = 'letter'; }],
  ['wrong raster resolution', (r: any) => { r.value.dpi = 72; }],
  ['decoder error despite success flags', (r: any) => { r.value.error = 'failed'; }],
  ['missing symbol', (r: any) => { r.value.symbols = []; }],
  ['different printed label', (r: any) => { r.printed.labels[0].mask = 7; }],
  ['invalid symbol index', (r: any) => { r.value.symbols[0].index = -1; r.printed.labels[0].index = -1; }],
  ['wrong symbol count', (r: any) => { r.printed.labels[0].total++; }],
  ['invalid QR version', (r: any) => { r.value.symbols[0].version = 41; r.printed.labels[0].version = 41; }],
  ['invalid correction level', (r: any) => { r.value.symbols[0].ec = 'Z'; r.printed.labels[0].level = 'Z'; }],
  ['invalid frame length', (r: any) => { r.value.symbols[0].bytes = 80; r.printed.labels[0].frameBytes = 80; }],
  ['missing page evidence', (r: any) => { r.value.symbols_per_page = []; }],
  ['inconsistent page count', (r: any) => { r.value.pages++; }],
] as const)('rejects %s', (_reason, edit) => {
  change(edit); const result = check();
  expect(result.status).toBe(1); expect(result.stdout).toBe('');
});

it.each(['original.ots', 'certificate.pdf'])('binds reports to the saved %s bytes', file => {
  writeFileSync(join(first(), file), 'modified'); expect(check().status).toBe(1);
});
