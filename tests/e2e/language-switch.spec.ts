import { expect, test, type Page } from '@playwright/test';
import { fromHex } from '../../src/core/bytes';
import { serializeProof } from '../../src/core/ots/codec';
import { sha256hex } from './helpers';

// PROPOSAL (docs/proposals/LANGUAGE_SWITCH.md): language is presentation state. Switching it keeps the selected
// file, receipt and fingerprint and any result, renders them in the new language, and never restarts or repeats work.
const CONTENT = Buffer.from('language fixture');
const HEX = sha256hex(CONTENT);
const digest = fromHex(HEX);
// An unknown calendar is inert, so verification ends PENDING without any network request.
const PENDING = Buffer.from(serializeProof({ digest, root: { msg: digest, children: [], attestations: [{ kind: 'pending', uri: 'https://untrusted.example' }] } }));

type Counters = { reads: string[]; workers: number; held: (() => void)[]; releases: (() => void)[] };
const counters = (page: Page): Promise<Counters> => page.evaluate(() => {
  const c = (window as unknown as { __c: Counters }).__c;
  return { reads: c.reads, workers: c.workers, held: [], releases: [] };
});

async function instrument(page: Page, opts: { holdRead?: boolean; holdHash?: boolean } = {}): Promise<void> {
  await page.evaluate(({ holdRead, holdHash }) => {
    const c: Counters = { reads: [], workers: 0, held: [], releases: [] };
    (window as unknown as { __c: Counters }).__c = c;
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function (): Promise<ArrayBuffer> {
      c.reads.push(this.name);
      const bytes = await read.call(this);
      if (holdRead) await new Promise<void>((resolve) => c.releases.push(resolve));
      return bytes;
    };
    const Original = window.Worker;
    window.Worker = class extends Original {
      constructor(src: string | URL, options?: WorkerOptions) {
        super(src, options);
        c.workers++;
      }
      override postMessage(message: unknown, transfer?: unknown): void {
        const go = (): void => super.postMessage(message, transfer as Transferable[]);
        if (holdHash) c.held.push(go);
        else go();
      }
    } as typeof Worker;
  }, { holdRead: opts.holdRead ?? false, holdHash: opts.holdHash ?? false });
}

async function switchToSpanish(page: Page): Promise<void> {
  await page.goto(`${page.url().split('#')[0]}#settings`);
  await page.getByRole('radio', { name: 'Español', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
}

test('a verification result and its inputs survive a language switch and are shown in the new language', async ({ page }) => {
  await page.goto(`/index.html#h=${HEX}`);
  await instrument(page);
  await page.setInputFiles('#verify-receipt', { name: 'kept.ots', mimeType: 'application/octet-stream', buffer: PENDING });
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.locator('.result-PENDING h3')).toHaveText('Not yet confirmed');

  await switchToSpanish(page);
  await page.goto(`/index.html#verify`);
  await expect(page.locator('.result-PENDING h3')).toHaveText('Aún sin confirmar');
  await expect(page.locator('#verify .picked')).toContainText('kept.ots');
  await expect(page.locator('#verify .notice code.digest')).toBeVisible(); // fingerprint from the link is kept
  await expect(page.getByRole('button', { name: 'Comprobar', exact: true })).toBeEnabled();
  expect((await counters(page)).reads).toEqual(['kept.ots']); // not re-run
});

test('a verification in progress completes once, in the new language', async ({ page }) => {
  await page.goto(`/index.html#h=${HEX}`);
  await instrument(page, { holdRead: true });
  await page.setInputFiles('#verify-receipt', { name: 'held.ots', mimeType: 'application/octet-stream', buffer: PENDING });
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.waitForFunction(() => (window as unknown as { __c: Counters }).__c.releases.length === 1);

  await switchToSpanish(page);
  await page.goto(`/index.html#verify`);
  await expect(page.getByRole('button', { name: 'Comprobando…', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { __c: Counters }).__c.releases.splice(0).forEach((go) => go()));
  await expect(page.locator('.result-PENDING h3')).toHaveText('Aún sin confirmar');
  expect((await counters(page)).reads).toEqual(['held.ots']);
});

test('a stamped file and its fingerprint survive a language switch without hashing again', async ({ page }) => {
  await page.goto('/index.html#stamp');
  await instrument(page);
  await page.setInputFiles('#stamp-file', { name: 'kept.txt', mimeType: 'text/plain', buffer: CONTENT });
  await expect(page.locator('.item code.digest')).toBeVisible();
  const shown = await page.locator('.item code.digest').textContent();

  await switchToSpanish(page);
  await page.goto('/index.html#stamp');
  await expect(page.locator('.item .item-name')).toHaveText('kept.txt');
  await expect(page.locator('.item code.digest')).toHaveText(shown!);
  await expect(page.locator('.item').getByRole('button', { name: 'Quitar', exact: true })).toBeVisible();
  expect((await counters(page)).workers).toBe(1);
});

test('a fingerprint being computed during a language switch finishes once', async ({ page }) => {
  await page.goto('/index.html#stamp');
  await instrument(page, { holdHash: true });
  await page.setInputFiles('#stamp-file', { name: 'held.txt', mimeType: 'text/plain', buffer: CONTENT });
  await page.waitForFunction(() => (window as unknown as { __c: Counters }).__c.held.length === 1);

  await switchToSpanish(page);
  await page.goto('/index.html#stamp');
  await expect(page.locator('.item .progress-label')).toContainText('Procesando');
  await page.evaluate(() => (window as unknown as { __c: Counters }).__c.held.splice(0).forEach((go) => go()));
  await expect(page.locator('.item code.digest')).toBeVisible();
  expect((await counters(page)).workers).toBe(1);
});
