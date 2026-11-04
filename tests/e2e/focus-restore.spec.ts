import { expect, test, type Page } from '@playwright/test';

// WCAG 2.4.3: re-rendering a container must keep keyboard focus on the same control, never drop it to the page
// and never move it to a different control (where Enter would then do something else).
const activeTag = (page: Page): Promise<string> => page.evaluate(() => document.activeElement?.tagName ?? '');

type Held = { held: (() => void)[] };
async function holdHash(page: Page): Promise<void> {
  await page.evaluate(() => {
    const c: Held = { held: [] };
    (window as unknown as { __h: Held }).__h = c;
    const Original = window.Worker;
    window.Worker = class extends Original {
      override postMessage(message: unknown, transfer?: unknown): void {
        c.held.push(() => super.postMessage(message, transfer as Transferable[]));
      }
    } as typeof Worker;
  });
}

test('verify: choosing a file keeps focus on the file input', async ({ page }) => {
  await page.goto('/index.html#verify');
  await page.locator('#verify-file').focus();
  await page.setInputFiles('#verify-file', { name: 'mine.txt', mimeType: 'text/plain', buffer: Buffer.from('hello mine') });
  await expect(page.locator('#verify .picked')).toContainText('mine.txt');
  await expect(page.locator('#verify-file')).toBeFocused();
  expect(await activeTag(page)).toBe('INPUT');
});

test('verify: choosing a receipt keeps focus on the receipt input', async ({ page }) => {
  await page.goto('/index.html#verify');
  await page.locator('#verify-receipt').focus();
  await page.setInputFiles('#verify-receipt', { name: 'r.ots', mimeType: 'application/octet-stream', buffer: Buffer.from('junk') });
  await expect(page.locator('#verify .picked')).toContainText('r.ots');
  await expect(page.locator('#verify-receipt')).toBeFocused();
});

test('stamp: Remove keeps focus when hashing finishes, and Enter removes the file rather than copying', async ({ page }) => {
  await page.goto('/index.html#stamp');
  await holdHash(page);
  await page.setInputFiles('#stamp-file', { name: 'big.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(4096, 7) });
  await page.waitForFunction(() => (window as unknown as { __h: Held }).__h.held.length > 0);
  const remove = page.locator('.item .item-head').getByRole('button', { name: 'Remove', exact: true });
  await remove.focus();
  await page.evaluate(() => (window as unknown as { __h: Held }).__h.held.splice(0).forEach((go) => go()));
  await expect(page.locator('.item .fingerprint code.digest')).toBeVisible();
  await expect(page.locator('.item .fingerprint').getByRole('button', { name: 'Copy', exact: true })).not.toBeFocused();
  await expect(remove).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.item')).toHaveCount(0);
});

test('settings: Space on the receipt-list toggle keeps focus on it', async ({ page }) => {
  await page.goto('/index.html#settings');
  const toggle = page.getByLabel('Remember my receipts on this device');
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toBeChecked();
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Space');
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeFocused();
});

test('settings: a calendar checkbox keeps focus when it is toggled', async ({ page }) => {
  await page.goto('/index.html#settings');
  const box = page.locator('#settings .advanced fieldset').first().locator('input[type=checkbox]').first();
  await box.focus();
  await page.keyboard.press('Space');
  await expect(box).not.toBeChecked();
  await expect(box).toBeFocused();
  await page.keyboard.press('Space');
  await expect(box).toBeChecked();
  await expect(box).toBeFocused();
});

test('settings: the minimum-calendars field keeps focus when stepped with the keyboard', async ({ page }) => {
  await page.goto('/index.html#settings');
  const min = page.locator('#min-cal');
  const before = await min.inputValue();
  await min.focus();
  await page.keyboard.press(before === '1' ? 'ArrowUp' : 'ArrowDown');
  await expect(min).not.toHaveValue(before);
  await expect(min).toBeFocused();
});

test('settings: removing a stored receipt never moves focus onto the next receipt', async ({ page }) => {
  await page.goto('/index.html#stamp');
  await page.evaluate(() => {
    localStorage.setItem('unaltered.receipts.enabled', '1');
    const rows = [1, 2, 3].map((n) => ({ digestHex: String(n).repeat(64), createdAtUtc: `2026-01-0${n}T00:00:00Z`, label: `r${n}` }));
    localStorage.setItem('unaltered.receipts.v1', JSON.stringify(rows));
  });
  await page.goto('/index.html#settings');
  const removes = page.locator('.receipt-list').getByRole('button', { name: 'Remove', exact: true });
  await expect(removes).toHaveCount(3);
  await removes.first().focus();
  await page.keyboard.press('Enter');
  await expect(removes).toHaveCount(2);
  // A held Enter repeats keydown; it must not reach another receipt's Remove button.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(removes).toHaveCount(2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('unaltered.receipts.v1') ?? '[]').length)).toBe(2);
  await expect(page.locator('#settings .receipts h3')).toBeFocused();
});
