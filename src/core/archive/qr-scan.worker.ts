import { decodeRasterFrames } from './qr-decode';

const ctx = globalThis as unknown as {
  onmessage: ((event: MessageEvent<{ data: Uint8ClampedArray; width: number; height: number }>) => void) | null;
  postMessage(value: unknown): void;
};
ctx.onmessage = event => {
  try {
    const { data, width, height } = event.data;
    if (!(data instanceof Uint8ClampedArray)) throw new Error('Invalid pixels');
    ctx.postMessage({ ok: true, frames: decodeRasterFrames(data, width, height) });
  } catch {
    ctx.postMessage({ ok: false });
  }
};
