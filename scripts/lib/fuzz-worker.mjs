// Dev-only in-process V8 session: no listening inspector port or product instrumentation.
import { Session } from 'node:inspector';
import { promisify } from 'node:util';
import { parentPort, workerData } from 'node:worker_threads';

const session = new Session();
session.connect();
const post = promisify(session.post.bind(session));
await post('Profiler.enable');
await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
const { runCase } = await import(workerData.targetUrl);
await post('Profiler.takePreciseCoverage'); // Exclude module initialization from input feedback.
const seen = new Map();
parentPort.on('message', async ({ target, bytes }) => {
  try {
    const outcome = runCase(target, bytes);
    if (outcome !== 'accepted' && outcome !== 'rejected') throw new Error('Invalid fuzz oracle outcome');
    const coverage = await post('Profiler.takePreciseCoverage');
    const keys = seen.get(target) ?? new Set();
    const before = keys.size;
    let observed = 0;
    for (const script of coverage.result) {
      if (script.url !== workerData.targetUrl) continue;
      for (const fn of script.functions) for (const range of fn.ranges) {
        if (range.count > 0) {
          observed++;
          keys.add(`${range.startOffset}:${range.endOffset}`);
        }
      }
    }
    if (!observed) throw new Error('No parser coverage observed; refusing unguided fallback');
    seen.set(target, keys);
    parentPort.postMessage({ outcome, novel: keys.size - before, ranges: keys.size });
  } catch (error) {
    parentPort.postMessage({ finding: { kind: 'exception', name: error instanceof Error ? error.name : 'NonErrorThrow', message: error instanceof Error ? error.message : String(error) } });
  }
});
parentPort.postMessage({ ready: true });
