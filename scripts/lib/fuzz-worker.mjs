// Dev-only in-process V8 session: no listening inspector port or product instrumentation.
import { Session } from 'node:inspector';
import { promisify } from 'node:util';
import { parentPort, workerData } from 'node:worker_threads';
import { executedIntervals } from './fuzz-coverage.mjs';

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
    // Await, so an asynchronous entry point (archival frame recovery hashes with WebCrypto) is checked to completion.
    const outcome = await runCase(target, bytes);
    if (outcome !== 'accepted' && outcome !== 'rejected') throw new Error('Invalid fuzz oracle outcome');
    const coverage = await post('Profiler.takePreciseCoverage');
    const executed = coverage.result.filter((script) => script.url === workerData.targetUrl).flatMap((script) => executedIntervals(script.functions));
    if (!executed.length) throw new Error('No parser coverage observed; refusing unguided fallback');
    // Feedback is the set of source offsets that have run for this target, which does not depend on V8's range shapes.
    const covered = seen.get(target) ?? { offsets: new Uint8Array(0), total: 0 };
    let novel = 0;
    for (const [start, end] of executed) {
      if (end > covered.offsets.length) {
        const grown = new Uint8Array(Math.max(end, covered.offsets.length * 2));
        grown.set(covered.offsets); covered.offsets = grown;
      }
      for (let offset = start; offset < end; offset++) if (!covered.offsets[offset]) { covered.offsets[offset] = 1; novel++; }
    }
    covered.total += novel;
    seen.set(target, covered);
    parentPort.postMessage({ outcome, novel, coveredOffsets: covered.total });
  } catch (error) {
    parentPort.postMessage({ finding: { kind: 'exception', name: error instanceof Error ? error.name : 'NonErrorThrow', message: error instanceof Error ? error.message : String(error) } });
  }
});
parentPort.postMessage({ ready: true });
