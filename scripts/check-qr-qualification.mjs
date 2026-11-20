#!/usr/bin/env node
// Require the full independent print/scan matrix, with every report bound to its saved receipt and PDF.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Deliberately independent of the Playwright case list: removing/skipping a case must fail this gate.
const cases = [
  ...[200, 3000, 12000].flatMap(fixture => ['L', 'M', 'Q', 'H'].map(level => ({ fixture, level, paper: 'a4' }))),
  { fixture: 3000, level: 'auto', paper: 'a4' }, { fixture: 3000, level: 'auto', paper: 'letter' },
  { fixture: 12000, level: 'H', paper: 'letter' },
];
const key = ({ fixture, level, paper }) => `${fixture}-${level}-${paper}`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

function readFile(path, maxBytes) {
  const info = lstatSync(path);
  assert.ok(info.isFile() && info.size > 0 && info.size <= maxBytes, 'Expected a bounded regular evidence file');
  return readFileSync(path);
}

function check(directory) {
  assert.ok(lstatSync(directory).isDirectory(), 'Expected an evidence directory, not a symbolic link');
  const entries = readdirSync(directory, { withFileTypes: true });
  assert.ok(entries.every(entry => entry.isDirectory()), 'Each case must be a real directory');
  assert.deepEqual(entries.map(entry => entry.name).sort(), cases.map(key).sort(), 'Expected exactly the 15 independent certificate cases');
  for (const c of cases) {
    const dir = join(directory, key(c));
    const receipt = readFile(join(dir, 'original.ots'), 16 * 1024 * 1024);
    const pdf = readFile(join(dir, 'certificate.pdf'), 64 * 1024 * 1024);
    const r = JSON.parse(readFile(join(dir, 'zxing-report.json'), 1024 * 1024).toString('utf8'));
    const size = c.fixture === 200 ? 325 : c.fixture === 3000 ? 3145 : 12217;
    assert.equal(receipt.length, size, `${key(c)}: unexpected receipt size`);
    assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-', `${key(c)}: missing PDF`);
    assert.deepEqual({ fixture: r.fixture, level: r.level, paper: r.paper }, c, `${key(c)}: wrong case`);
    assert.equal(r.size, size); assert.equal(r.status, 0, `${key(c)}: decoder did not exit successfully`);
    const v = r.value, printed = r.printed;
    assert.equal(v.decoder, 'zxing-cpp 3.1.1'); assert.equal(v.dpi, 150);
    assert.equal(v.recovered, true); assert.equal(v.identical, true);
    assert.ok(!Object.hasOwn(v, 'error'), `${key(c)}: decoder reported an error`);
    assert.equal(v.original_sha256, hash(receipt)); assert.equal(v.recovered_sha256, hash(receipt));
    assert.equal(v.pdf_sha256, hash(pdf));
    assert.ok(Array.isArray(printed.labels) && integer(printed.labels.length, 1, 4096));
    assert.ok(Array.isArray(v.symbols)); assert.equal(v.symbols.length, printed.labels.length);
    for (const [index, label] of printed.labels.entries()) {
      assert.equal(label.index, index); assert.equal(label.total, printed.labels.length);
      assert.ok(integer(label.version, 1, 40) && /^[LMQH]$/.test(label.level));
      assert.ok(integer(label.mask, 0, 7) && integer(label.frameBytes, 81, 2953));
      if (c.level !== 'auto') assert.equal(label.level, c.level);
      assert.deepEqual(v.symbols[index], {
        index, bytes: label.frameBytes, version: label.version, ec: label.level, mask: label.mask,
      }, `${key(c)}: decoded symbol differs from its printed label`);
    }
    const perPage = [Math.min(2, printed.labels.length)];
    for (let remaining = printed.labels.length - perPage[0]; remaining > 0; remaining -= 4) perPage.push(Math.min(4, remaining));
    perPage.push(0); // The human-readable appendix contains no QR symbol.
    assert.equal(printed.pages, perPage.length); assert.equal(v.pages, perPage.length);
    assert.deepEqual(v.symbols_per_page, perPage, `${key(c)}: incomplete page evidence`);
  }
}

try {
  assert.ok(process.argv.length <= 3, 'Usage: node scripts/check-qr-qualification.mjs [evidence-directory]');
  check(resolve(process.argv[2] ?? 'test-results/qr-independent'));
  console.log('Validated all 15 independent QR certificate cases and their receipt/PDF evidence.');
} catch (error) {
  console.error(`QR qualification evidence failed: ${error.message}`);
  process.exitCode = 1;
}
