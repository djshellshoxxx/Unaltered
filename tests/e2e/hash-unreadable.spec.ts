import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// A real disk-backed File that the browser can no longer read once selected (native NotFoundError / NotReadableError).
// The UI must show the typed, generic input message, never a raw browser message or the catch-all text.
const UNREADABLE = 'The browser stopped delivering the file. Try again, or copy the file to a local disk first.';
const bytes = Buffer.alloc(64 * 1024, 0x61);

type WorkerReplies = Window & { __hashReplies?: { type: string; code: string | null }[]; __hashStarts?: number };

/** Records the hash worker's terminal reply types and how often hashing was started. Holds no file data. */
function recordWorkerReplies(): void {
  const w = window as WorkerReplies;
  w.__hashReplies = [];
  w.__hashStarts = 0;
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options);
      this.addEventListener('message', (event: MessageEvent<unknown>) => {
        const m = event.data as Record<string, unknown> | null;
        if (m && typeof m === 'object' && typeof m.type === 'string' && m.type !== 'ready' && m.type !== 'progress') {
          w.__hashReplies!.push({ type: m.type, code: typeof m.code === 'string' ? m.code : null });
        }
      });
    }
    override postMessage(message: unknown, options?: StructuredSerializeOptions | Transferable[]): void {
      if ((message as { type?: unknown } | null)?.type === 'start') w.__hashStarts! += 1;
      super.postMessage(message, Array.isArray(options) ? { transfer: options } : options);
    }
  };
}

async function selectThenBreak(page: Page, change: 'deleted' | 'modified'): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'unaltered-unreadable-'));
  try {
    const path = join(directory, 'synthetic.bin');
    await writeFile(path, bytes);
    await page.goto('/index.html#verify');
    // A path (not a buffer) makes the browser back the File with the disk file, like a real user selection.
    await page.setInputFiles('#verify-file', path);
    await page.setInputFiles('#verify-receipt', { name: 'synthetic.ots', mimeType: 'application/octet-stream', buffer: Buffer.from([0, 1, 2]) });
    if (change === 'deleted') {
      await rm(path);
    } else {
      await writeFile(path, Buffer.alloc(bytes.length, 0x62));
      await utimes(path, new Date(Date.now() + 60_000), new Date(Date.now() + 60_000));
    }
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

for (const change of ['deleted', 'modified'] as const) {
  test(`worker path: a file ${change} after selection falls back once and reports a typed unreadable error`, async ({ page }) => {
    await page.addInitScript(recordWorkerReplies);
    await selectThenBreak(page, change);
    await expect(page.getByRole('alert')).toHaveText(UNREADABLE);
    const w = await page.evaluate(() => ({ replies: (window as WorkerReplies).__hashReplies, starts: (window as WorkerReplies).__hashStarts }));
    // The worker hands the rejected read back ('error'); the main-thread fallback then fails with the typed error.
    expect(w).toEqual({ replies: [{ type: 'error', code: null }], starts: 1 });
  });

  test(`main-thread fallback: a file ${change} after selection reports a typed unreadable error`, async ({ page }) => {
    await page.addInitScript(() => { Reflect.deleteProperty(window, 'Worker'); });
    await selectThenBreak(page, change);
    await expect(page.getByRole('alert')).toHaveText(UNREADABLE);
  });
}
