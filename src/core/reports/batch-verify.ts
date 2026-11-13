import type { VerifyReport, VerifyState } from '../ots/verify';

export type BatchResult<T> =
  | { input: T; status: VerifyState; report: VerifyReport; error?: never }
  | { input: T; status: 'ERROR'; error: string; report?: never };

/**
 * Execute a bounded list sequentially. Each item gets an independent result;
 * an invalid receipt cannot hide another item's successful verification.
 * The caller supplies the real file-hash and OTS verification operation.
 */
export async function verifyBatch<T>(
  inputs: readonly T[],
  verifyOne: (input: T) => Promise<VerifyReport>,
  signal?: AbortSignal,
): Promise<BatchResult<T>[]> {
  if (inputs.length === 0 || inputs.length > 50)
    throw new Error('Batch must contain between 1 and 50 items');
  const results: BatchResult<T>[] = [];
  for (const input of inputs) {
    if (signal?.aborted) break;
    try {
      const report = await verifyOne(input);
      results.push({ input, status: report.state, report });
    } catch (error) {
      // Cancellation is not a failed verification. Keep completed results only;
      // the caller may distinguish an interrupted batch by its shorter length.
      if (signal?.aborted) break;
      results.push({
        input,
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Verification failed',
      });
    }
  }
  return results;
}
