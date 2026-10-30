import assert from 'node:assert/strict';
import { test } from 'node:test';
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
