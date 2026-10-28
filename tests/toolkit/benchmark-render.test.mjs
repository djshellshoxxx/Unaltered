// Exercise the real benchmark renderer without a browser, network or dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const template = readFileSync(new URL('../../skills/skill-creator/eval-viewer/viewer.html', import.meta.url), 'utf8');
const helper = template.slice(template.indexOf('function escapeHtml(text)'), template.indexOf('// ---- View switching ----'));
const renderer = template.slice(template.indexOf('function renderBenchmark()'), template.indexOf('// ---- Start ----'));

test('benchmark metadata, labels, counts, deltas and attribute text remain data', () => {
  const payload = '<img src=x onerror="globalThis.audit=1">';
  const attribute = '" onmouseover="globalThis.audit=1';
  const stat = { mean: 1, stddev: 0 };
  const benchmark = {
    metadata: { skill_name: payload, timestamp: payload, evals_run: [payload], runs_per_configuration: payload },
    run_summary: {
      [payload]: { pass_rate: stat, time_seconds: stat, tokens: stat },
      delta: { pass_rate: payload, time_seconds: payload, tokens: payload },
    },
    runs: [
      { eval_id: 1, eval_name: payload, configuration: payload, run_number: attribute,
        result: { pass_rate: 1, passed: payload, total: payload, errors: payload },
        expectations: [{ text: payload, passed: true, evidence: attribute }] },
      { eval_id: 1, configuration: payload, run_number: 2, result: { pass_rate: 1, errors: 1 } },
    ],
    notes: [payload],
  };
  let rendered = '';
  const container = { set innerHTML(markup) { rendered = markup; } };
  const document = {
    getElementById: (id) => id === 'benchmark-content' ? container : { style: {} },
    createElement: () => ({
      textContent: '',
      // Browser textContent-to-innerHTML escapes text delimiters, not quotes.
      get innerHTML() {
        return String(this.textContent).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      },
    }),
  };
  runInNewContext(`${helper}\n${renderer}\nrenderBenchmark();`, { document, EMBEDDED_DATA: { benchmark } });
  assert.doesNotMatch(rendered, /<img\b/i);
  assert.ok(!rendered.includes(attribute), 'Untrusted quotes must not break out of title attributes');
  assert.match(rendered, /&lt;img/);
  assert.match(rendered, /&quot; onmouseover=&quot;globalThis.audit=1/);
  assert.match(rendered, /<td>2<\/td>/, 'Ordinary values still render');
});
