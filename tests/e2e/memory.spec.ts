import { createHash } from 'node:crypto';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { installHashIoDiagnostics } from './hash-io-diagnostics';

// FR-1 requires browser evidence, not only the virtual-source Node test. This Linux/Chromium-only
// acceptance test measures all renderer RSS (including the worker and ArrayBuffer backing stores).
test('hashes a real 2 GiB file in the browser with less than 200 MiB extra renderer RSS', async ({ page, browser, browserName }) => {
  test.skip(process.env.UNALTERED_BIG_BROWSER !== '1', 'Opt-in 2 GiB browser acceptance test.');
  test.skip(process.platform !== 'linux' || browserName !== 'chromium', 'RSS measurement uses Linux procfs and Chromium CDP.');
  test.setTimeout(600_000);
  const directory = await mkdtemp(join(tmpdir(), 'unaltered-browser-memory-'));
  const file = join(directory, 'two-gibibytes.bin');
  const size = 2 * 1024 ** 3;
  const cdp = await browser.newBrowserCDPSession();
  const started = Date.now();
  const phase = (name: string): void => { console.log(`memory-acceptance ${name} elapsedMs=${Date.now() - started}`); };
  try {
    // A sparse file has the same browser-readable bytes as a real zero-filled file without a 2 GiB allocation.
    const handle = await open(file, 'w');
    try { await handle.truncate(size); } finally { await handle.close(); }
    phase('file-created');
    await page.goto('/index.html#stamp');
    phase('page-ready');
    const rss = async (): Promise<number> => {
      const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
      const renderers = processInfo.filter((p) => p.type === 'renderer');
      expect(renderers.length).toBeGreaterThan(0);
      const values = await Promise.all(renderers.map(async ({ id }) => {
        const status = await readFile(`/proc/${id}/status`, 'utf8');
        const match = /^VmRSS:\s+(\d+)\s+kB$/m.exec(status);
        if (!match) throw new Error('Renderer RSS is not available.');
        return Number(match[1]) * 1024;
      }));
      return values.reduce((sum, value) => sum + value, 0);
    };
    const before = await rss();
    let peak = before;
    let sampling = true;
    let hashWorker: import('@playwright/test').Worker | undefined;
    let ioQueryPending = false;
    let lastIo: unknown;
    let nextHeartbeat = Date.now() + 10_000;
    const monitor = (async () => {
      while (sampling) {
        peak = Math.max(peak, await rss());
        if (Date.now() >= nextHeartbeat) {
          // Do not pause 50 ms RSS sampling while the browser answers the diagnostic query.
          void page.evaluate(() => document.querySelector('progress')?.getAttribute('value') ?? null)
            .then((progress) => phase(`progress=${progress} extraRendererRss=${peak - before}`))
            .catch(() => phase('progress-query-unavailable'));
          if (hashWorker && !ioQueryPending) {
            ioQueryPending = true;
            void hashWorker.evaluate(() => ({
              ...(globalThis as unknown as { __hashIoTrace?: object }).__hashIoTrace, now: performance.now(),
            })).then((state) => { lastIo = state; phase(`worker-io=${JSON.stringify(state)}`); })
              .catch(() => phase('worker-io-unavailable')).finally(() => { ioQueryPending = false; });
          }
          nextHeartbeat = Date.now() + 10_000;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    })();
    try {
      const worker = page.waitForEvent('worker');
      phase('input-start');
      await page.setInputFiles('#stamp-file', file);
      phase('input-selected');
      hashWorker = await worker; // A silently substituted main-thread implementation does not satisfy FR-1.
      hashWorker.on('close', () => phase('worker-closed'));
      await hashWorker.evaluate(installHashIoDiagnostics);
      phase('worker-observed');
      // Surface a terminal UI/read failure or a failed RSS monitor immediately instead of hiding it
      // behind the digest wait. This preserves the success criteria and the existing time limit.
      const completed = page.waitForFunction(() => document.querySelector('.item .digest') !== null
        || document.querySelector('.item .error') !== null, undefined, { timeout: 540_000 }).then((handle) => handle.dispose());
      await Promise.race([completed, monitor]);
      expect(await page.locator('.item .error').allTextContents()).toEqual([]);
      await expect(page.locator('.item .digest')).toBeVisible();
      phase('digest-visible');
    } finally {
      sampling = false;
      await monitor;
      await test.info().attach('hash-io-last-observation', { body: JSON.stringify(lastIo ?? null), contentType: 'application/json' });
    }
    // Independent Node crypto reference, streamed in fixed chunks rather than loading the source file.
    const expected = createHash('sha256');
    const chunk = Buffer.alloc(4 * 1024 ** 2);
    for (let offset = 0; offset < size; offset += chunk.length) expected.update(chunk);
    const digest = await page.locator('.item .digest').textContent();
    expect(digest?.replace(/ /g, '')).toBe(expected.digest('hex'));
    expect(peak - before).toBeLessThan(200 * 1024 ** 2);
    test.info().annotations.push({ type: 'peak-extra-renderer-rss-bytes', description: String(peak - before) });
  } finally {
    await cdp.detach();
    await rm(directory, { recursive: true, force: true });
  }
});
