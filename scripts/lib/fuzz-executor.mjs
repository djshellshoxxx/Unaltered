import { Worker } from 'node:worker_threads';

/** One case at a time. A stuck synchronous parser is terminated by the independent parent timer. */
export async function createExecutor(targetUrl, { timeoutMs = 1000, startupMs = 10000 } = {}) {
  const worker = new Worker(new URL('./fuzz-worker.mjs', import.meta.url), {
    workerData: { targetUrl }, resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
  });
  let pending;
  let closed = false;
  const fail = (error) => {
    closed = true;
    if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = undefined; }
    void worker.terminate().catch(() => {});
  };
  const wait = (ms) => new Promise((resolve, reject) => {
    if (closed || pending) { reject(new Error('Executor is closed or busy')); return; }
    const timer = setTimeout(() => fail(Object.assign(new Error(`Worker deadline exceeded (${ms}ms)`), { code: 'FUZZ_TIMEOUT' })), ms);
    pending = { resolve, reject, timer };
  });
  const ready = wait(startupMs);
  worker.on('message', (message) => {
    if (!pending) return;
    const current = pending;
    pending = undefined;
    clearTimeout(current.timer);
    current.resolve(message);
  });
  worker.on('error', fail);
  worker.on('exit', (code) => { if (!closed) fail(new Error(`Fuzz worker exited (${code})`)); });
  try {
    if (!(await ready).ready) throw new Error('Fuzz worker initialization failed');
  } catch (error) { fail(error); throw error; }
  return {
    runCase(target, bytes) { const result = wait(timeoutMs); worker.postMessage({ target, bytes }); return result; },
    async close() { closed = true; if (pending) fail(new Error('Executor closed')); await worker.terminate(); },
  };
}
