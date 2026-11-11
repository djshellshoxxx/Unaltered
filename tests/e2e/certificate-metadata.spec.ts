import { expect, test } from '@playwright/test';
import { archivalReceiptFixture } from '../helpers/archival-receipt';

test('document label is opt-in, escaped, and never embedded in QR receipt bytes', async ({ page }) => {
  const receipt = Buffer.from(archivalReceiptFixture(100));
  await page.goto('/index.html#verify');
  await page.getByLabel('Choose a .ots receipt for a QR certificate').setInputFiles({
    name: 'private-document.ots', mimeType: 'application/octet-stream', buffer: receipt,
  });
  const label = page.getByRole('textbox', { name: 'Document title or filename' });
  await expect(label).toBeDisabled();
  await page.getByRole('button', { name: 'Preview QR certificate', exact: true }).click();
  await expect(page.locator('.unaltered-archival-sheet')).not.toContainText('private-document.ots');
  await expect(page.locator('.unaltered-archival-sheet')).toContainText('Not independently checked');
  await expect(page.locator('.unaltered-archival-sheet')).toContainText('Certificate generated (device clock, UTC)');
  await page.getByRole('button', { name: 'Close certificate preview' }).click();
  await page.getByRole('checkbox', { name: 'Include an optional document title or filename on the certificate' }).check();
  await label.fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Preview QR certificate', exact: true }).click();
  await expect(page.locator('.unaltered-archival-sheet')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.unaltered-archival-sheet img')).toHaveCount(0);
  const firstFrame = await page.locator('.unaltered-archival-sheet canvas').first().evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByRole('button', { name: 'Close certificate preview' }).click();
  await page.getByRole('checkbox', { name: 'Include an optional document title or filename on the certificate' }).uncheck();
  await page.getByRole('button', { name: 'Preview QR certificate', exact: true }).click();
  await expect(page.locator('.unaltered-archival-sheet')).not.toContainText('<img src=x onerror=alert(1)>');
  expect(await page.locator('.unaltered-archival-sheet canvas').first().evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(firstFrame);
});

test('optional document label survives language switching without opting in automatically', async ({ page }) => {
  await page.goto('/index.html#verify');
  await page.getByLabel('Choose a .ots receipt for a QR certificate').setInputFiles({
    name: 'proof.ots', mimeType: 'application/octet-stream', buffer: Buffer.from(archivalReceiptFixture(100)),
  });
  await page.getByRole('checkbox', { name: 'Include an optional document title or filename on the certificate' }).check();
  await page.getByRole('textbox', { name: 'Document title or filename' }).fill('My chosen document');
  await page.goto('/index.html#settings');
  await page.getByRole('radio', { name: 'Español', exact: true }).check();
  await page.goto('/index.html#verify');
  await expect(page.getByRole('checkbox', { name: 'Incluir un título o nombre de archivo opcional en el certificado' })).toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Título del documento o nombre de archivo' })).toHaveValue('My chosen document');
  await page.getByRole('button', { name: 'Vista previa del certificado QR', exact: true }).click();
  await expect(page.locator('.unaltered-archival-sheet')).toContainText('My chosen document');
});
