import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

async function expectDocumentReflow(page: Page): Promise<void> {
  const size = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(size.documentWidth, JSON.stringify(size)).toBeLessThanOrEqual(size.viewportWidth);
}

// These CSS viewport widths model the layout space of a 1280px window at 200%/400% zoom. They do not
// automate the browser's zoom UI, physical display scaling or a human screen-reader/high-contrast review.
for (const [width, equivalentZoom] of [[640, 200], [320, 400]] as const) {
  test(`all views reflow at ${width} CSS px (${equivalentZoom}% layout equivalent) with a long Unicode filename`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/index.html#stamp');
    const name = `${'記録-🌍-á-'.repeat(12)}.txt`;
    const bytes = Buffer.from('Synthetic local reflow fixture.');
    await page.setInputFiles('#stamp-file', { name, mimeType: 'text/plain', buffer: bytes });
    await expect(page.locator('.item .digest')).toBeVisible();
    expect((await page.locator('.item .digest').textContent())?.replace(/ /g, ''))
      .toBe(createHash('sha256').update(bytes).digest('hex'));
    await expect(page.locator('.item-name')).toHaveText(name);
    await expectDocumentReflow(page);

    for (const view of ['verify', 'about', 'settings', 'stamp']) {
      const link = page.locator(`#nav-${view}`);
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator(`#${view}`)).toBeVisible();
      await expect(link).toHaveAttribute('aria-current', 'page');
      if (view === 'about') {
        await page.locator('details.l2 summary').focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('pre.cmd')).toBeVisible();
      }
      await expectDocumentReflow(page);
    }
    await expect(page.locator('.item-name')).toHaveText(name);
    await expect(page.locator('.item .digest')).toBeVisible();
  });
}

test('reduced motion and supported forced colors preserve operable keyboard controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await page.goto('/index.html#settings');
  const media = await page.evaluate(() => ({
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    forcedColors: matchMedia('(forced-colors: active)').matches,
  }));
  expect(media.reducedMotion).toBe(true);
  expect(media.forcedColors).toBe(true);
  const spanish = page.getByRole('radio', { name: 'Español', exact: true });
  await spanish.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(spanish).toBeChecked();
  await expect(spanish).toBeFocused();
  expect(await spanish.evaluate((control) => getComputedStyle(control).outlineStyle)).toBe('solid');
});
