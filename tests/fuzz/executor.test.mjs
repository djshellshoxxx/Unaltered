import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executedIntervals } from '../../scripts/lib/fuzz-coverage.mjs';
import { createExecutor } from '../../scripts/lib/fuzz-executor.mjs';

const targetUrl = new URL('./executor-fixture.mjs', import.meta.url).href;
test('coverage feedback distinguishes new paths from repeated inputs', async () => {
  const worker = await createExecutor(targetUrl);
  try {
    const first = await worker.runCase('accept', new Uint8Array());
    assert.equal(first.outcome, 'accepted'); assert.ok(first.novel > 0);
    const repeat = await worker.runCase('accept', new Uint8Array());
    assert.equal(repeat.novel, 0);
    assert.equal((await worker.runCase('reject', new Uint8Array())).outcome, 'rejected');
  } finally { await worker.close(); }
});
test('coverage feedback sees a new branch that runs as often as its function', async () => {
  const worker = await createExecutor(targetUrl);
  try {
    const then = await worker.runCase('branch', Uint8Array.of(1));
    assert.ok(then.novel > 0);
    const otherwise = await worker.runCase('branch', Uint8Array.of(0));
    assert.ok(otherwise.novel > 0, 'first run of the else branch must count as new coverage');
    assert.ok(otherwise.coveredOffsets > then.coveredOffsets);
    assert.equal((await worker.runCase('branch', Uint8Array.of(0))).novel, 0);
    assert.equal((await worker.runCase('branch', Uint8Array.of(1))).novel, 0);
  } finally { await worker.close(); }
});
test('coverage feedback counts a nested function body only once it runs', async () => {
  const worker = await createExecutor(targetUrl);
  try {
    assert.ok((await worker.runCase('nested', Uint8Array.of(0))).novel > 0);
    assert.ok((await worker.runCase('nested', Uint8Array.of(1))).novel > 0, 'first call of the inner function must count as new coverage');
    assert.equal((await worker.runCase('nested', Uint8Array.of(0))).novel, 0);
  } finally { await worker.close(); }
});
test('executed intervals follow the innermost reported V8 range', () => {
  const fn = (...ranges) => ({ ranges: ranges.map(([startOffset, endOffset, count]) => ({ startOffset, endOffset, count })) });
  // Raw V8 output for `if (bytes[0] === 1) {...} else {...}`: the branch that ran is merged into the function range.
  assert.deepEqual(executedIntervals([fn([25, 121, 1], [84, 98, 0])]), [[25, 84], [98, 121]]);
  assert.deepEqual(executedIntervals([fn([25, 121, 1], [76, 84, 0])]), [[25, 76], [84, 121]]);
  // An uncalled nested function is its own entry; a count inside a count-0 block still counts.
  assert.deepEqual(executedIntervals([fn([60, 70, 2]), fn([0, 100, 1], [10, 50, 0], [20, 30, 3]), fn([40, 45, 0])]), [[0, 10], [20, 30], [50, 60], [60, 70], [70, 100]]);
  assert.deepEqual(executedIntervals([fn([0, 10, 0])]), []);
  assert.throws(() => executedIntervals([fn([0, 50, 1]), fn([40, 60, 1])]), /Crossing V8 coverage ranges/);
});
test('coverage feedback ignores count-only changes over the same blocks', async () => {
  const worker = await createExecutor(targetUrl);
  try {
    const first = await worker.runCase('loop', Uint8Array.of(1, 0));
    assert.ok(first.novel > 0);
    for (const bytes of [Uint8Array.of(1, 0, 0), Uint8Array.of(0, 1, 1, 1), Uint8Array.of(0, 1)]) {
      const again = await worker.runCase('loop', bytes);
      assert.equal(again.novel, 0, `same blocks with other counts (${bytes.join(',')}) are not new coverage`);
      assert.equal(again.coveredOffsets, first.coveredOffsets);
    }
    assert.ok(first.coveredOffsets > 0);
  } finally { await worker.close(); }
});
test('unexpected parser exceptions remain findings', async () => {
  const worker = await createExecutor(targetUrl);
  try {
    const result = await worker.runCase('throw', new Uint8Array());
    assert.deepEqual(result.finding, { kind: 'exception', name: 'RangeError', message: 'fixture exception' });
  } finally { await worker.close(); }
});
test('parent deadline terminates a synchronous parser hang', async () => {
  const worker = await createExecutor(targetUrl, { timeoutMs: 50 });
  try {
    await assert.rejects(worker.runCase('hang', new Uint8Array()), { code: 'FUZZ_TIMEOUT' });
    await assert.rejects(worker.runCase('accept', new Uint8Array()), /closed/);
  } finally { await worker.close(); }
});
test('unexpected worker exit fails the pending input', async () => {
  const worker = await createExecutor(targetUrl);
  try { await assert.rejects(worker.runCase('exit', new Uint8Array()), /exited \(9\)/); }
  finally { await worker.close(); }
});
