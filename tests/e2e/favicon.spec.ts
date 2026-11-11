import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { cspViolations, watchViolations } from './helpers';

for (const offline of [false, true]) {
  test(`${offline ? 'standalone' : 'hosted'} favicon loads without weakening CSP`, async ({ page }) => {
    const errors = await watchViolations(page);
    const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;
    await page.goto(offline ? pathToFileURL(resolve(`dist/unaltered-${version}.html`)).href : '/index.html');
    const icon = page.locator('head link[rel="icon"]');
    await expect(icon).toHaveCount(1);
    await expect(icon).toHaveAttribute('type', 'image/png');
    await expect(icon).toHaveAttribute('href', offline ? /^blob:/ : './favicon.png');
    const dimensions = await icon.evaluate(async element => {
      const image = new Image();
      image.src = (element as HTMLLinkElement).href;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    });
    expect(dimensions).toEqual([64, 64]);
    expect(await cspViolations(page)).toEqual([]);
    expect(errors.list).toEqual([]);
  });
}
