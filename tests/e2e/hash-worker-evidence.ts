import type { Page } from '@playwright/test';

interface HashWorkerEvidence {
  starts: number[];
  done: { bytes: number | null; hex: string | null; cross: string | null }[];
  failures: string[];
}

type EvidenceWindow = Window & { __unalteredHashWorkers?: HashWorkerEvidence[] };

/** Install before navigation. Page-side messages also work where Worker.evaluate is unavailable. */
export function installHashWorkerEvidence(): void {
  const evidence: HashWorkerEvidence[] = [];
  (window as EvidenceWindow).__unalteredHashWorkers = evidence;
  const NativeWorker = window.Worker;
  const records = new WeakMap<Worker, HashWorkerEvidence>();
  window.Worker = class extends NativeWorker {
    constructor(scriptURL: string | URL, options?: WorkerOptions) {
      super(scriptURL, options);
      const record: HashWorkerEvidence = { starts: [], done: [], failures: [] };
      records.set(this, record);
      evidence.push(record);
      // Register before the app's onmessage handler, which terminates a completed worker.
      // Keep only scalar evidence: never retain the input Blob or progress buffers.
      this.addEventListener('message', (event: MessageEvent<unknown>) => {
        if (typeof event.data !== 'object' || event.data === null) return;
        const message = event.data as Record<string, unknown>;
        if (message.type === 'done') {
          record.done.push({
            bytes: typeof message.bytes === 'number' && Number.isSafeInteger(message.bytes) ? message.bytes : null,
            hex: message.digest instanceof Uint8Array && message.digest.length === 32
              ? Array.from(message.digest, (byte) => byte.toString(16).padStart(2, '0')).join('') : null,
            cross: typeof message.cross === 'string' ? message.cross : null,
          });
        } else if (message.type === 'failed' || message.type === 'error' || message.type === 'cancelled') {
          record.failures.push(message.type);
        }
      });
      this.addEventListener('error', () => record.failures.push('error-event'));
      this.addEventListener('messageerror', () => record.failures.push('messageerror-event'));
    }

    override postMessage(message: unknown, transfer: Transferable[]): void;
    override postMessage(message: unknown, options?: StructuredSerializeOptions): void;
    override postMessage(message: unknown, options?: Transferable[] | StructuredSerializeOptions): void {
      if (typeof message === 'object' && message !== null) {
        const input = message as Record<string, unknown>;
        if (input.type === 'start' && input.blob instanceof Blob) records.get(this)!.starts.push(input.blob.size);
      }
      if (Array.isArray(options)) super.postMessage(message, options);
      else super.postMessage(message, options);
    }
  };
}

/** A visible digest after worker creation can come from main-thread fallback; it is not this evidence. */
export async function requireHashWorkerCompletion(page: Page, expected: { bytes: number; hex: string }): Promise<HashWorkerEvidence> {
  const evidence = await page.evaluate(() => (window as EvidenceWindow).__unalteredHashWorkers ?? []);
  const hashing = evidence.filter((record) => record.starts.length > 0);
  const record = hashing[0];
  const done = record?.done[0];
  if (hashing.length !== 1 || record?.starts.length !== 1 || record.starts[0] !== expected.bytes
    || record.done.length !== 1 || record.failures.length !== 0 || done?.bytes !== expected.bytes
    || done.hex !== expected.hex || (done.cross !== 'ok' && done.cross !== 'skipped')) {
    throw new Error(`Expected one successful hash worker completion for ${expected.bytes} bytes and ${expected.hex}; observed ${JSON.stringify(evidence)}`);
  }
  return record;
}
