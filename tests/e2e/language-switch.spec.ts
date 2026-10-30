import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { fromHex, toHex } from '../../src/core/bytes';
import { collectAttestations, parseProof, serializeProof } from '../../src/core/ots/codec';
import { installNetwork, sha256hex } from './helpers';

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

async function switchToEnglish(page: Page): Promise<void> {
  await page.goto(`${page.url().split('#')[0]}#settings`);
  await page.getByRole('radio', { name: 'English', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
}

/** Stamps CONTENT through the UI (mocked calendars) and returns the downloaded pending receipt. */
async function stampedReceipt(page: Page): Promise<Buffer> {
  await page.goto('/index.html#stamp');
  await page.setInputFiles('#stamp-file', { name: 'up.txt', mimeType: 'text/plain', buffer: CONTENT });
  await page.getByLabel(/I understand and want to continue/).check();
  await page.getByRole('button', { name: 'Create receipt' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Download receipt/ }).click()]);
  return readFileSync((await dl.path())!);
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

test('a receipt created but not yet downloaded survives EN→ES→EN with no new calendar request', async ({ page, context }) => {
  const chain = await installNetwork(context);
  await page.goto('/index.html#stamp');
  await page.setInputFiles('#stamp-file', { name: 'kept.txt', mimeType: 'text/plain', buffer: CONTENT });
  await expect(page.locator('.item code.digest')).toBeVisible();
  await page.getByLabel(/I understand and want to continue/).check();
  await page.getByRole('button', { name: 'Create receipt' }).click();
  await expect(page.getByRole('link', { name: /Download receipt/ })).toBeVisible();
  expect(chain.digestPosts).toHaveLength(3);

  await switchToSpanish(page);
  await page.goto('/index.html#stamp');
  await expect(page.locator('.item .item-name')).toHaveText('kept.txt');
  await expect(page.getByRole('link', { name: 'Descargar recibo (kept.txt.ots)' })).toBeVisible();

  await switchToEnglish(page);
  await page.goto('/index.html#stamp');
  const link = page.getByRole('link', { name: 'Download receipt (kept.txt.ots)' });
  const [dl] = await Promise.all([page.waitForEvent('download'), link.click()]);
  const receipt = parseProof(new Uint8Array(readFileSync((await dl.path())!)));
  expect(toHex(receipt.digest)).toBe(HEX);
  expect(chain.digestPosts).toHaveLength(3); // nothing re-submitted
});

test('an upgrade result and its download survive a language switch without asking the calendars again', async ({ page, context }) => {
  const chain = await installNetwork(context, { confirm: true });
  const pending = await stampedReceipt(page);
  await page.goto('/index.html#verify');
  await page.setInputFiles('#upgrade-receipt', { name: 'up.ots', mimeType: 'application/octet-stream', buffer: pending });
  await page.getByRole('button', { name: 'Check for confirmation' }).click();
  await expect(page.getByRole('link', { name: 'Download upgraded receipt (up.upgraded.ots)' })).toBeVisible();
  const gets = chain.timestampGets.length;

  await switchToSpanish(page);
  await page.goto('/index.html#verify');
  await expect(page.getByText('Confirmado en Bitcoin.', { exact: false })).toBeVisible();
  const link = page.getByRole('link', { name: 'Descargar recibo actualizado (up.upgraded.ots)' });
  const [dl] = await Promise.all([page.waitForEvent('download'), link.click()]);
  const upgraded = parseProof(new Uint8Array(readFileSync((await dl.path())!)));
  expect(collectAttestations(upgraded.root).some((a) => a.attestation.kind === 'bitcoin')).toBe(true);
  expect(chain.timestampGets).toHaveLength(gets);
});

test('an upgrade waiting on the network during a language switch completes once', async ({ page, context }) => {
  const chain = await installNetwork(context, { confirm: true });
  const pending = await stampedReceipt(page);
  const held: (() => Promise<void>)[] = [];
  await context.route('https://*/timestamp/**', (route) => { held.push(() => route.fallback()); });
  await page.goto('/index.html#verify');
  await page.setInputFiles('#upgrade-receipt', { name: 'up.ots', mimeType: 'application/octet-stream', buffer: pending });
  await page.getByRole('button', { name: 'Check for confirmation' }).click();
  await expect.poll(() => held.length).toBe(3);

  await switchToSpanish(page);
  await page.goto('/index.html#verify');
  await Promise.all(held.splice(0).map((go) => go()));
  await expect(page.getByRole('link', { name: 'Descargar recibo actualizado (up.upgraded.ots)' })).toBeVisible();
  expect(chain.timestampGets).toHaveLength(3); // one request per calendar, not repeated
});
