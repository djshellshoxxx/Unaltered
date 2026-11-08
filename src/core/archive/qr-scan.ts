import { makeQrWorker } from '../hash/hasher';
import { UnalteredError } from '../errors';
import { MAX_QR_IMAGE_PIXELS, MAX_QR_IMAGE_SIDE, MAX_QR_SYMBOLS_PER_IMAGE } from './qr-limits';
import { MAX_QR_IMAGE_BYTES, qrImageDimensions } from './qr-image';

type ScannerFactory = () => { worker: Worker; dispose(): void } | null;
const unreadable = (): UnalteredError => new UnalteredError('INPUT_UNREADABLE', 'The QR image could not be read. Try a clear PNG or JPEG, with each complete QR and its white border visible.');

/** Transfer pixels to a bounded worker. Abort and timeout terminate decoding, never merely hide its result. */
export function scanQrPixels(data: Uint8ClampedArray, width: number, height: number,
  signal?: AbortSignal, factory: ScannerFactory = makeQrWorker): Promise<Uint8Array[]> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new UnalteredError('ABORTED', 'Cancelled.')); return; }
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 21 || height < 21 ||
        width > MAX_QR_IMAGE_SIDE || height > MAX_QR_IMAGE_SIDE || width * height > MAX_QR_IMAGE_PIXELS ||
        data.length !== width * height * 4) { reject(unreadable()); return; }
    const owned = factory();
    if (!owned) { reject(unreadable()); return; }
    let settled = false;
    const { worker } = owned;
    const finish = (error?: Error, frames?: Uint8Array[]): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      owned.dispose();
      if (error) reject(error); else resolve(frames ?? []);
    };
    const abort = (): void => finish(new UnalteredError('ABORTED', 'Cancelled.'));
    const timer = setTimeout(() => finish(unreadable()), 45_000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => {
      const value: unknown = event.data;
      if (!value || typeof value !== 'object' || !('ok' in value) || value.ok !== true ||
          !('frames' in value) || !Array.isArray(value.frames) || value.frames.length > MAX_QR_SYMBOLS_PER_IMAGE ||
          value.frames.some((frame: unknown) => !(frame instanceof Uint8Array) || frame.length < 81 || frame.length > 2953)) {
        finish(unreadable()); return;
      }
      finish(undefined, value.frames as Uint8Array[]);
    };
    worker.onerror = worker.onmessageerror = () => finish(unreadable());
    try { worker.postMessage({ data, width, height }, [data.buffer]); } catch { finish(unreadable()); }
  });
}

/** Browser image decoding is gated by byte/header dimensions before native raster allocation. */
export async function scanQrImage(file: Blob, signal?: AbortSignal): Promise<Uint8Array[]> {
  if (signal?.aborted) throw new UnalteredError('ABORTED', 'Cancelled.');
  if (!file.size || file.size > MAX_QR_IMAGE_BYTES) throw unreadable();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (signal?.aborted) throw new UnalteredError('ABORTED', 'Cancelled.');
  try { qrImageDimensions(bytes); } catch { throw unreadable(); }
  const bitmap = await createImageBitmap(new Blob([bytes]));
  const canvas = document.createElement('canvas');
  try {
    if (signal?.aborted) throw new UnalteredError('ABORTED', 'Cancelled.');
    if (bitmap.width > MAX_QR_IMAGE_SIDE || bitmap.height > MAX_QR_IMAGE_SIDE ||
        bitmap.width * bitmap.height > MAX_QR_IMAGE_PIXELS) throw unreadable();
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw unreadable();
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return await scanQrPixels(image.data, image.width, image.height, signal);
  } finally { bitmap.close(); canvas.width = canvas.height = 0; }
}
