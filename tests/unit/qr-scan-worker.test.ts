import { afterEach, expect, it, vi } from 'vitest';
import { QR_SCAN_TIMEOUT_MS, scanQrPixels } from '../../src/core/archive/qr-scan';

afterEach(() => vi.useRealTimers());
it('terminates a scanner when cancelled and never accepts a late result', async () => {
  let stopped = false;
  const worker = { postMessage() {}, onmessage: null, onerror: null, onmessageerror: null };
  const controller = new AbortController();
  const result = scanQrPixels(new Uint8ClampedArray(21 * 21 * 4), 21, 21, controller.signal,
    () => ({ worker: worker as unknown as Worker, dispose: () => { stopped = true; } }));
  controller.abort();
  await expect(result).rejects.toMatchObject({ code: 'ABORTED' });
  expect(stopped).toBe(true);
});
it('bounds scan execution and rejects malformed worker results', async () => {
  vi.useFakeTimers();
  let stopped = false;
  const worker = { postMessage() {}, onmessage: null, onerror: null, onmessageerror: null };
  const pending = scanQrPixels(new Uint8ClampedArray(21 * 21 * 4), 21, 21, undefined,
    () => ({ worker: worker as unknown as Worker, dispose: () => { stopped = true; } }));
  const assertion = expect(pending).rejects.toMatchObject({ code: 'INPUT_UNREADABLE' });
  await vi.advanceTimersByTimeAsync(QR_SCAN_TIMEOUT_MS - 1);
  expect(stopped).toBe(false);
  await vi.advanceTimersByTimeAsync(2);
  await assertion;
  expect(stopped).toBe(true);
});
