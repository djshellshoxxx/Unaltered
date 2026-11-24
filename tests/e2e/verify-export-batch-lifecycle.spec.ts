import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { fromHex } from '../../src/core/bytes';
import { serializeProof } from '../../src/core/ots/codec';
import { TABLES } from '../../src/ui/strings';
import { installNetwork, sha256hex } from './helpers';

const CONTENT = Buffer.from('export and batch lifecycle fixture');
const DIGEST = fromHex(sha256hex(CONTENT));
const PENDING = Buffer.from(serializeProof({ digest: DIGEST, root: {
  msg: DIGEST, children: [], attestations: [{ kind: 'pending', uri: 'https://untrusted.example' }],
} }));
const file = (name: string, buffer: Buffer = CONTENT): { name: string; mimeType: string; buffer: Buffer } => ({
  name, mimeType: 'application/octet-stream', buffer,
});

interface LifecycleProbe {
  reads: string[];
  workers: number;
  downloads: string[];
  pendingReads: number;
  pendingDigests: number;
  release?: () => void;
}
declare global {
  interface Window { __lifecycleProbe?: LifecycleProbe }
}

/** Gate only the completion of one real native read; hashing and downloads still use the browser. */
async function installProbe(page: Page, heldName: string | null = null): Promise<void> {
  await page.evaluate((heldName) => {
    const probe: LifecycleProbe = { reads: [], workers: 0, downloads: [], pendingReads: 0, pendingDigests: 0 };
    window.__lifecycleProbe = probe;
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function (): Promise<ArrayBuffer> {
      probe.reads.push(this.name);
      probe.pendingReads++;
      try {
        const bytes = await read.call(this);
        if (this.name === heldName) await new Promise<void>((resolve) => { probe.release = resolve; });
        return bytes;
      } finally { probe.pendingReads--; }
    };
    // Track native crypto completion so a negative download assertion cannot race ZIP preparation.
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (algorithm, data): Promise<ArrayBuffer> => {
      probe.pendingDigests++;
      try { return await digest(algorithm, data); }
      finally { probe.pendingDigests--; }
    };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (): void {
      if (this.download) probe.downloads.push(this.download);
      click.call(this);
    };
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(source: string | URL, options?: WorkerOptions) {
        super(source, options);
        probe.workers++;
      }
    } as typeof Worker;
  }, heldName);
}

async function waitForRead(page: Page): Promise<void> {
  await page.waitForFunction(() => !!window.__lifecycleProbe?.release);
}

async function releaseAndSettle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const probe = window.__lifecycleProbe;
    if (!probe?.release) throw new Error('The native file read has not reached its gate');
    probe.release();
    delete probe.release;
    // One task boundary drains the promise continuations that start native crypto, if any.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  await page.waitForFunction(() => {
    const probe = window.__lifecycleProbe;
    return probe !== undefined && probe.pendingReads === 0 && probe.pendingDigests === 0;
  });
  // The final digest's microtasks must finish before checking whether a download was attempted.
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
}

async function observed(page: Page): Promise<{ reads: string[]; workers: number; downloads: string[] }> {
  return page.evaluate(() => {
    const probe = window.__lifecycleProbe;
    if (!probe) throw new Error('The lifecycle probe has not been installed');
    const { reads, workers, downloads } = probe;
    return { reads, workers, downloads };
  });
}

async function switchLanguage(page: Page, language: 'en' | 'es'): Promise<void> {
  await page.goto('/index.html#settings');
  await page.getByRole('radio', { name: language === 'es' ? 'Español' : 'English', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await page.goto('/index.html#verify');
}

async function selectEvidence(page: Page): Promise<void> {
  await page.setInputFiles('#verify-file', file('kept.txt'));
  await page.setInputFiles('#verify-receipt', file('kept.txt.ots', PENDING));
}

async function selectBatch(page: Page, receipt = PENDING): Promise<void> {
  await page.setInputFiles('#batch-files', file('kept.txt'));
  await page.setInputFiles('#batch-receipts', file('kept.txt.ots', receipt));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html#verify');
});

test.describe('evidence export lifecycle in the browser', () => {
  for (const change of ['cancel', 'file', 'receipt'] as const) {
    test(`a held export cannot download after ${change}`, async ({ page }) => {
      await installProbe(page, 'kept.txt');
      await selectEvidence(page);
      await page.getByRole('button', { name: TABLES.en['evidence.downloadZip'], exact: true }).click();
      await waitForRead(page);
      await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: TABLES.en['evidence.preparing'], exact: true })).toBeDisabled();

      if (change === 'cancel') await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      else if (change === 'file') await page.setInputFiles('#verify-file', file('replacement.txt', Buffer.from('replacement')));
      else await page.setInputFiles('#verify-receipt', file('replacement.ots', Buffer.from('replacement receipt')));

      await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: TABLES.en['evidence.downloadZip'], exact: true })).toBeEnabled();
      await releaseAndSettle(page);
      await expect(page.locator('.verify-result')).toBeEmpty();
      expect((await observed(page)).downloads).toEqual([]);
    });
  }

  test('a held export survives a language switch and downloads the selected bytes exactly once', async ({ page }) => {
    await installProbe(page, 'kept.txt');
    await selectEvidence(page);
    await page.getByRole('button', { name: TABLES.en['evidence.downloadZip'], exact: true }).click();
    await waitForRead(page);
    await switchLanguage(page, 'es');
    await expect(page.getByRole('button', { name: TABLES.es['evidence.preparing'], exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Comprobar', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cancelar', exact: true })).toBeEnabled();
    await expect(page.locator('#verify .inputs .picked')).toHaveText([
      `kept.txt · ${CONTENT.length} B`, `kept.txt.ots · ${PENDING.length} B`,
    ]);

    const [download] = await Promise.all([page.waitForEvent('download'), releaseAndSettle(page)]);
    expect(download.suggestedFilename()).toBe('unaltered-evidence.zip');
    const zip = readFileSync((await download.path())!);
    expect(zip.includes(CONTENT)).toBe(true);
    expect(zip.includes(PENDING)).toBe(true);
    expect(zip.includes(Buffer.from(sha256hex(CONTENT)))).toBe(true);
    expect(zip.includes(Buffer.from(sha256hex(PENDING)))).toBe(true);
    expect(await observed(page)).toEqual({ reads: ['kept.txt', 'kept.txt.ots'], workers: 0, downloads: ['unaltered-evidence.zip'] });
    await expect(page.getByRole('button', { name: 'Comprobar', exact: true })).toBeEnabled();
  });

  test('the evidence size explanation follows the language without reading rejected files', async ({ page }) => {
    await installProbe(page);
    await page.setInputFiles('#verify-file', file('large.bin', Buffer.alloc(16 * 1024 * 1024)));
    await page.setInputFiles('#verify-receipt', file('large.bin.ots', PENDING));
    await page.getByRole('button', { name: TABLES.en['evidence.downloadZip'], exact: true }).click();
    const error = page.locator('.verify-result [role=alert]');
    await expect(error).toHaveText(TABLES.en['evidence.limit']);
    await switchLanguage(page, 'es');
    await expect(error).toHaveText(TABLES.es['evidence.limit']);
    await expect(page.getByRole('button', { name: 'Comprobar', exact: true })).toBeEnabled();
    expect(await observed(page)).toEqual({ reads: [], workers: 0, downloads: [] });
  });
});

test.describe('batch presentation lifecycle in the browser', () => {
  test('working and cancelled batches relabel without restarting work or accepting a late result', async ({ page }) => {
    await installProbe(page, 'kept.txt.ots');
    await selectBatch(page);
    const batch = page.locator('.batch-verify');
    const output = batch.locator('.batch-results');
    await batch.getByRole('button', { name: 'Verify batch', exact: true }).click();
    await waitForRead(page);
    await expect(output).toHaveText(TABLES.en['batch.working']);
    await switchLanguage(page, 'es');
    await expect(output).toHaveText(TABLES.es['batch.working']);
    await batch.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(output).toHaveText(TABLES.es['batch.cancelled']);
    await expect(batch.getByRole('button', { name: 'Verificar lote', exact: true })).toBeEnabled();
    await releaseAndSettle(page);
    await expect(output).toHaveText(TABLES.es['batch.cancelled']);
    await expect(output.locator('li')).toHaveCount(0);
    await switchLanguage(page, 'en');
    await expect(output).toHaveText(TABLES.en['batch.cancelled']);
    expect(await observed(page)).toEqual({ reads: ['kept.txt.ots'], workers: 1, downloads: [] });
  });

  for (const input of ['batch-files', 'batch-receipts'] as const) {
    test(`replacing ${input} clears a working batch and discards its late result`, async ({ page }) => {
      await installProbe(page, 'kept.txt.ots');
      await selectBatch(page);
      const batch = page.locator('.batch-verify');
      await batch.getByRole('button', { name: 'Verify batch', exact: true }).click();
      await waitForRead(page);
      await page.setInputFiles(`#${input}`, input === 'batch-files' ? file('new.txt') : file('new.txt.ots', PENDING));
      await expect(batch.locator('.batch-results')).toBeEmpty();
      await expect(batch.getByRole('button', { name: 'Verify batch', exact: true })).toBeEnabled();
      await releaseAndSettle(page);
      await expect(batch.locator('.batch-results')).toBeEmpty();
      expect(await observed(page)).toEqual({ reads: ['kept.txt.ots'], workers: 1, downloads: [] });
    });
  }

  test('a completed Bitcoin block label relabels without hashing or requesting explorer data again', async ({ page, context }) => {
    const chain = await installNetwork(context);
    chain.roots.set(840_000, DIGEST);
    const confirmed = Buffer.from(serializeProof({ digest: DIGEST, root: {
      msg: DIGEST, children: [], attestations: [{ kind: 'bitcoin', height: 840_000 }],
    } }));
    const explorerRequests: string[] = [];
    page.on('request', (request) => {
      if (/^https:\/\/(?:mempool\.space|blockstream\.info)\/api\//.test(request.url())) explorerRequests.push(request.url());
    });
    await installProbe(page);
    await selectBatch(page, confirmed);
    const output = page.locator('.batch-results');
    await page.getByRole('button', { name: 'Verify batch', exact: true }).click();
    await expect(output).toContainText('VERIFIED');
    await expect(output).toContainText('Bitcoin block: 840000');
    expect(explorerRequests).toHaveLength(4);
    const originalRequests = [...explorerRequests];
    await switchLanguage(page, 'es');
    await expect(output).toContainText('Bloque de Bitcoin: 840000');
    await switchLanguage(page, 'en');
    await expect(output).toContainText('Bitcoin block: 840000');
    await expect(output).toContainText('VERIFIED');
    await expect(output).toContainText('kept.txt');
    expect(explorerRequests).toEqual(originalRequests);
    expect(await observed(page)).toEqual({ reads: ['kept.txt.ots'], workers: 1, downloads: [] });
  });

  test('a pairing error relabels and clears when the matching receipt is selected', async ({ page }) => {
    await installProbe(page);
    await page.setInputFiles('#batch-files', file('kept.txt'));
    await page.setInputFiles('#batch-receipts', file('other.txt.ots', PENDING));
    const output = page.locator('.batch-results');
    await page.getByRole('button', { name: 'Verify batch', exact: true }).click();
    await expect(output).toHaveText(TABLES.en['batch.pairError']);
    await switchLanguage(page, 'es');
    await expect(output).toHaveText(TABLES.es['batch.pairError']);
    expect(await observed(page)).toEqual({ reads: [], workers: 0, downloads: [] });
    await page.setInputFiles('#batch-receipts', file('kept.txt.ots', PENDING));
    await expect(output).toBeEmpty();
    await page.getByRole('button', { name: 'Verificar lote', exact: true }).click();
    await expect(output).toContainText('PENDING');
    expect(await observed(page)).toEqual({ reads: ['kept.txt.ots'], workers: 1, downloads: [] });
  });
});
