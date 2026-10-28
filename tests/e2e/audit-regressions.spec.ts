import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { groupHex, toHex } from '../../src/core/bytes';
import { parseProof } from '../../src/core/ots/codec';
import { cleanJpeg } from '../../src/core/strip/jpeg';
import { makeJpeg } from '../helpers/images';
import { installNetwork } from './helpers';

async function download(page: Page, link: Locator): Promise<Buffer> {
  const [file] = await Promise.all([page.waitForEvent('download'), link.click()]);
  return readFileSync((await file.path())!);
}

for (const initiallyCleaned of [true, false]) {
  test(`changing cleaning from ${initiallyCleaned} invalidates the old receipt and requires a new stamp`, async ({ page, context }) => {
    await installNetwork(context);
    const original = makeJpeg({ exif: { gps: true }, comment: 'synthetic metadata' });
    const cleaned = cleanJpeg(original);
    if (cleaned.kind !== 'cleaned') throw new Error('Invalid synthetic fixture');
    const fingerprint = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
    const oldHex = fingerprint(initiallyCleaned ? cleaned.output : original);
    const nextHex = fingerprint(initiallyCleaned ? original : cleaned.output);
    expect(oldHex).not.toBe(nextHex);
    await page.goto('/index.html#stamp');
    await page.setInputFiles('#stamp-file', { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(original) });
    const item = page.locator('.item');
    const cleaning = item.getByLabel('Remove hidden data');
    if (!initiallyCleaned) await cleaning.uncheck();
    await expect(item.locator('.digest')).toHaveText(groupHex(oldHex));
    if (initiallyCleaned) await download(page, item.getByRole('link', { name: /Download cleaned copy/ }));
    else await item.getByLabel(/I understand and want to continue/).check();
    await page.getByRole('button', { name: 'Create receipt', exact: true }).click();
    const oldReceipt = await download(page, item.getByRole('link', { name: /Download receipt/ }));
    expect(toHex(parseProof(oldReceipt).digest)).toBe(oldHex);

    await cleaning.setChecked(!initiallyCleaned);
    await expect(item.locator('.digest')).toHaveText(groupHex(nextHex));
    await expect(item.getByRole('link', { name: /Download receipt/ })).toHaveCount(0);
    await expect(page.getByText('Pending: not yet proof.', { exact: true })).toHaveCount(0);
    const create = page.getByRole('button', { name: 'Create receipt', exact: true });
    await expect(create).toBeDisabled();
    if (initiallyCleaned) await item.getByLabel(/I understand and want to continue/).check();
    else await download(page, item.getByRole('link', { name: /Download cleaned copy/ }));
    await create.click();
    const nextReceipt = await download(page, item.getByRole('link', { name: /Download receipt/ }));
    expect(toHex(parseProof(nextReceipt).digest)).toBe(nextHex);
  });
}

for (const fragment of ['verify', 'settings', 'about', `verify&h=${'a'.repeat(64)}`]) {
  test(`keyboard skip link preserves ${fragment.includes('&') ? 'verify fingerprint' : fragment} and focuses main content`, async ({ page }) => {
    await page.goto(`/index.html#${fragment}`);
    await page.locator('#skip').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#app')).toBeFocused();
    expect(new URL(page.url()).hash).toBe(`#${fragment}`);
    await expect(page.locator(`#${fragment.split('&')[0]}`)).toBeVisible();
  });
}
