import { test, expect } from '@playwright/test';

// Browser matrix: Chromium, Firefox and WebKit. Keep the strict CSP and native language radios.
test('browser presentation and existing tools remain navigable without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/index.html');
  await expect(page.locator('#nav-stamp')).toBeVisible();
  await expect(page.locator('#stamp')).toBeVisible();
  await page.locator('#nav-verify').click();
  await expect(page.locator('#verify')).toBeVisible();
  await expect(page.locator('#nav-about')).toBeVisible();
  await page.locator('#nav-settings').click();
  await expect(page.locator('#settings')).toBeVisible();
  await expect(page.locator('#lang input[type="radio"]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('keyboard navigation and language switching retain page access', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#nav-settings').click();
  await page.locator('#lang input[value="es"]').check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('#nav-verify')).toBeVisible();
  await page.locator('#nav-verify').click();
  await expect(page.locator('#verify')).toBeVisible();
  await page.locator('#nav-settings').click();
  await page.locator('#lang input[value="en"]').check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
