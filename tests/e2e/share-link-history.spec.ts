import { expect, test, type Page } from '@playwright/test';

// main.ts routes on every hashchange. Back/Forward to a share link re-reads the same #h=, which is not a new link:
// it must not replace the file the user chose since, clear its result or abort a running check.
const LINK = 'ab'.repeat(32);
const OTHER = 'cd'.repeat(32);
const MINE = { name: 'mine.txt', mimeType: 'text/plain', buffer: Buffer.from('hello mine') };
const junk = (name: string): { name: string; mimeType: string; buffer: Buffer } => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.from('junk receipt') });
const PREFILLED = 'Fingerprint from a link';

async function chooseFileAndReceipt(page: Page, receipt = 'receipt.ots'): Promise<void> {
  await page.goto(`/index.html#h=${LINK}`);
  await expect(page.locator('#verify .notice')).toContainText(PREFILLED);
  await page.setInputFiles('#verify-file', MINE);
  await page.setInputFiles('#verify-receipt', junk(receipt));
  await expect(page.locator('#verify .notice')).toHaveCount(0);
}

async function expectKept(page: Page): Promise<void> {
  await expect(page.locator('#verify')).toBeVisible();
  await expect(page.locator('#verify .picked').first()).toContainText('mine.txt');
  await expect(page.locator('#verify').getByText(PREFILLED)).toHaveCount(0);
}

test('Back and Forward to a share link keep the chosen file and its result', async ({ page }) => {
  await chooseFileAndReceipt(page);
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  const result = page.locator('.result-INVALID_PROOF');
  await expect(result).toBeVisible();

  await page.locator('#nav-about').click();
  await expect(page.locator('#about')).toBeVisible();
  await page.goBack();
  expect(new URL(page.url()).hash).toBe(`#h=${LINK}`);
  await expectKept(page);
  await expect(result).toBeVisible();

  await page.goForward();
  await expect(page.locator('#about')).toBeVisible();
  await page.goBack();
  await expectKept(page);
  await expect(result).toBeVisible();
});

test('Back to a share link does not abort a check that is still running', async ({ page }) => {
  await page.goto(`/index.html#h=${LINK}`);
  await page.evaluate(() => {
    const w = window as unknown as { __controllers: AbortController[]; __release?: () => void };
    w.__controllers = [];
    const Original = window.AbortController;
    window.AbortController = class extends Original {
      constructor() {
        super();
        w.__controllers.push(this);
      }
    };
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function (): Promise<ArrayBuffer> {
      const bytes = await read.call(this);
      if (this.name === 'held.ots') await new Promise<void>((resolve) => { w.__release = resolve; });
      return bytes;
    };
  });
  await page.setInputFiles('#verify-file', MINE);
  await page.setInputFiles('#verify-receipt', junk('held.ots'));
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.waitForFunction(() => !!(window as unknown as { __release?: () => void }).__release);

  await page.locator('#nav-stamp').click();
  await expect(page.locator('#stamp')).toBeVisible();
  await page.goBack();
  await expectKept(page);
  expect(await page.evaluate(() => (window as unknown as { __controllers: AbortController[] }).__controllers[0]!.signal.aborted)).toBe(false);
  await page.evaluate(() => (window as unknown as { __release: () => void }).__release());
  await expect(page.locator('.result-INVALID_PROOF')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeEnabled();
});

test('a different share link still replaces the chosen file', async ({ page }) => {
  await chooseFileAndReceipt(page);
  await page.goto(`/index.html#h=${OTHER}`);
  await expect(page.locator('#verify .notice')).toContainText(PREFILLED);
  await expect(page.locator('#verify .notice code.digest')).toContainText(OTHER.slice(0, 4));
  await expect(page.locator('#verify')).not.toContainText('mine.txt');
});
