import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { encodeReceiptFrames } from '../../src/core/archive/frames';
import { archivalReceiptFixture } from '../helpers/archival-receipt';
import { cspViolations, installNetwork, watchViolations } from './helpers';

type ArchiveWork = { reads: string[]; workers: number; stopped: number; held: (() => void)[] };

async function watchWork(page: Page, holdWorker = false): Promise<void> {
  await page.evaluate(hold => {
    const work: ArchiveWork = { reads: [], workers: 0, stopped: 0, held: [] };
    (window as unknown as { __archiveWork: ArchiveWork }).__archiveWork = work;
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
      work.reads.push(this.name);
      return read.call(this);
    };
    const Original = window.Worker;
    window.Worker = class extends Original {
      constructor(source: string | URL, options?: WorkerOptions) {
        super(source, options);
        work.workers++;
      }
      override postMessage(message: unknown, transfer?: unknown): void {
        const send = (): void => super.postMessage(message, transfer as Transferable[]);
        if (hold) work.held.push(send); else send();
      }
      override terminate(): void { work.stopped++; super.terminate(); }
    } as typeof Worker;
  }, holdWorker);
}

async function workCounts(page: Page): Promise<Omit<ArchiveWork, 'held'>> {
  return page.evaluate(() => {
    const { reads, workers, stopped } = (window as unknown as { __archiveWork: ArchiveWork }).__archiveWork;
    return { reads, workers, stopped };
  });
}

async function switchLanguage(page: Page, language: 'English' | 'Español'): Promise<void> {
  await page.goto('/index.html#settings');
  await page.getByRole('radio', { name: language, exact: true }).check();
  await page.goto('/index.html#verify');
}

async function watchRevocations(page: Page): Promise<void> {
  await page.evaluate(() => {
    const revoked: string[] = [];
    (window as unknown as { __revokedCertificateUrls: string[] }).__revokedCertificateUrls = revoked;
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string): void => { revoked.push(url); revoke(url); };
  });
}

const revokedUrls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __revokedCertificateUrls: string[] }).__revokedCertificateUrls);

test('certificate input, options and prepared QR pixels survive language changes without rereading', async ({ page }) => {
  const errors = await watchViolations(page);
  const original = Buffer.from(archivalReceiptFixture(100));
  await page.goto('/index.html#verify');
  await watchWork(page);
  await page.getByLabel('Choose a .ots receipt for a QR certificate').setInputFiles({
    name: 'kept.ots', mimeType: 'application/octet-stream', buffer: original,
  });
  await page.locator('.archival-import summary').click();
  await page.locator('.archival-import input[value="H"]').check();
  await page.locator('.archival-import input[value="letter"]').check();

  await switchLanguage(page, 'Español');
  await expect(page.locator('.archival-import input[value="H"]')).toBeChecked();
  await expect(page.locator('.archival-import input[value="letter"]')).toBeChecked();
  await expect(page.locator('.archival-import details')).toHaveAttribute('open', '');
  expect((await workCounts(page)).reads).toEqual([]);
  await page.getByRole('button', { name: 'Vista previa del certificado QR', exact: true }).click();
  await expect(page.locator('.archival-preview')).toBeVisible();
  await expect(page.locator('.archival-preview > .archival-digital-guidance strong')).toHaveText('Guarda el recibo digital .ots siempre que sea posible.');
  await expect(page.locator('.archival-preview > .archival-digital-guidance')).toContainText('los bytes exactos del archivo de recibo original');
  const digitalReceipt = page.locator('.archival-toolbar a[download]');
  await expect(digitalReceipt).toHaveText('Guardar recibo digital (.ots)');
  const href = await digitalReceipt.getAttribute('href');
  const pixels = await page.locator('.archival-preview canvas').evaluateAll(canvases => canvases.map(canvas => (canvas as HTMLCanvasElement).toDataURL()));

  await switchLanguage(page, 'English');
  await expect(page.getByRole('button', { name: 'Print certificate / Save as PDF', exact: true })).toBeVisible();
  await expect(page.locator('.archival-preview')).toHaveCount(1);
  await expect(page.locator('.archival-preview .archival-page').first()).toHaveAttribute('data-paper', 'letter');
  await expect(page.locator('.archival-preview > .archival-digital-guidance strong')).toHaveText('Save the digital .ots receipt whenever possible.');
  await expect(page.locator('.archival-preview > .archival-digital-guidance')).toContainText('the exact bytes of the original receipt file');
  await expect(page.locator('.unaltered-archival-sheet .archival-digital-guidance strong')).toHaveText('Save the digital .ots receipt whenever possible. ');
  await expect(digitalReceipt).toHaveText('Save digital receipt (.ots)');
  await expect(digitalReceipt).toHaveAttribute('href', href!);
  const [download] = await Promise.all([page.waitForEvent('download'), digitalReceipt.click()]);
  expect(readFileSync((await download.path())!)).toEqual(original);
  expect(await page.locator('.archival-preview canvas').evaluateAll(canvases => canvases.map(canvas => (canvas as HTMLCanvasElement).toDataURL()))).toEqual(pixels);
  expect((await workCounts(page)).reads).toEqual(['kept.ots']);
  await watchRevocations(page);
  await page.getByRole('button', { name: 'Close certificate preview', exact: true }).click();
  await expect(digitalReceipt).toHaveCount(0);
  expect(await revokedUrls(page)).toContain(href);
  expect(await cspViolations(page)).toEqual([]);
  expect(errors.list).toEqual([]);
});

test('an undownloaded recovered receipt survives EN to ES to EN with no repeated reads', async ({ page }) => {
  const errors = await watchViolations(page);
  const original = Buffer.from(archivalReceiptFixture(100));
  const frames = await encodeReceiptFrames(original, 2953);
  await page.goto('/index.html#verify');
  await watchWork(page);
  await page.getByLabel('Choose QR images or binary frame files').setInputFiles(frames.map((frame, index) => ({
    name: `kept-${index}.bin`, mimeType: 'application/octet-stream', buffer: Buffer.from(frame),
  })));
  await page.getByRole('button', { name: 'Recover receipt from QR images', exact: true }).click();
  const link = page.locator('.archival-recovery a[download]');
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  const before = await workCounts(page);

  await switchLanguage(page, 'Español');
  await expect(link).toHaveText('Descargar recibo .ots recuperado');
  await expect(page.locator('.archival-recovery [role=status]')).toContainText('Se recuperaron');
  await switchLanguage(page, 'English');
  await expect(link).toHaveAttribute('href', href!);
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  expect(readFileSync((await download.path())!)).toEqual(original);
  expect(await workCounts(page)).toEqual(before);
  await page.getByLabel('Choose QR images or binary frame files').setInputFiles([]);
  await expect(link).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Recover receipt from QR images', exact: true })).toBeDisabled();
  expect(await cspViolations(page)).toEqual([]);
  expect(errors.list).toEqual([]);
});

test('an active QR decoder survives a language switch and completes once in the selected language', async ({ page }) => {
  const errors = await watchViolations(page);
  const original = Buffer.from(archivalReceiptFixture(100));
  await page.goto('/index.html#verify');
  await page.getByLabel('Choose a .ots receipt for a QR certificate').setInputFiles({ name: 'scan.ots', mimeType: 'application/octet-stream', buffer: original });
  await page.getByRole('button', { name: 'Preview QR certificate', exact: true }).click();
  const save = page.locator('.archival-toolbar button').filter({ hasText: /Save QR .*PNG/ });
  await expect(save).toHaveCount(1);
  const [png] = await Promise.all([page.waitForEvent('download'), save.click()]);
  const image = readFileSync((await png.path())!);
  await page.getByRole('button', { name: 'Close certificate preview' }).click();
  await watchWork(page, true);
  await page.getByLabel('Choose QR images or binary frame files').setInputFiles({ name: 'held.png', mimeType: 'image/png', buffer: image });
  await page.getByRole('button', { name: 'Recover receipt from QR images', exact: true }).click();
  await page.waitForFunction(() => (window as unknown as { __archiveWork: ArchiveWork }).__archiveWork.held.length === 1);

  await switchLanguage(page, 'Español');
  await expect(page.getByRole('button', { name: 'Recuperar recibo de imágenes QR', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancelar escaneo QR', exact: true })).toBeEnabled();
  await expect(page.locator('.archival-recovery [role=status]')).toContainText('Escaneando localmente');
  expect(await workCounts(page)).toEqual({ reads: ['held.png'], workers: 1, stopped: 0 });
  await page.evaluate(() => (window as unknown as { __archiveWork: ArchiveWork }).__archiveWork.held.splice(0).forEach(send => send()));
  const link = page.getByRole('link', { name: 'Descargar recibo .ots recuperado', exact: true });
  await expect(link).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  expect(readFileSync((await download.path())!)).toEqual(original);
  expect(await workCounts(page)).toEqual({ reads: ['held.png'], workers: 1, stopped: 1 });
  expect(await cspViolations(page)).toEqual([]);
  expect(errors.list).toEqual([]);
});

test('Stamp retains certificate choices across relabel and removes its preview with the receipt', async ({ page, context }) => {
  const errors = await watchViolations(page);
  const chain = await installNetwork(context);
  await page.goto('/index.html#stamp');
  await page.locator('#stamp-file').setInputFiles({ name: 'keep.txt', mimeType: 'text/plain', buffer: Buffer.from('keep certificate preferences') });
  await page.getByLabel(/I understand and want to continue/).check();
  await page.getByRole('button', { name: 'Create receipt', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Preview QR certificate', exact: true })).toBeVisible();
  await page.locator('.item .archival-controls summary').click();
  await page.locator('.item .archival-controls input[value="H"]').check();
  await page.locator('.item .archival-controls input[value="letter"]').check();
  await switchLanguage(page, 'Español');
  await page.goto('/index.html#stamp');
  await expect(page.locator('.item .archival-controls input[value="H"]')).toBeChecked();
  await expect(page.locator('.item .archival-controls input[value="letter"]')).toBeChecked();
  await page.getByRole('button', { name: 'Vista previa del certificado QR', exact: true }).click();
  await expect(page.locator('.archival-preview')).toBeVisible();
  await switchLanguage(page, 'English');
  await page.goto('/index.html#stamp');
  await expect(page.getByRole('button', { name: 'Close certificate preview', exact: true })).toBeVisible();
  expect(chain.digestPosts).toHaveLength(3);
  const href = await page.getByRole('link', { name: 'Save digital receipt (.ots)', exact: true }).getAttribute('href');
  await watchRevocations(page);
  await page.locator('.item').getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('.archival-preview')).toHaveCount(0);
  expect(await revokedUrls(page)).toContain(href);
  expect(await cspViolations(page)).toEqual([]);
  expect(errors.list).toEqual([]);
});
