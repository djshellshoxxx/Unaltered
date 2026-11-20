import { expect, test } from '@playwright/test';
import { DEFAULT_CALENDARS, DEFAULT_EXPLORERS } from '../../src/core/net/allowlist';
import { MAX_STAMP_FILES } from '../../src/core/ots/calendar';
import { TABLES } from '../../src/ui/strings';
import { cspViolations, watchViolations } from './helpers';

for (const lang of ['en', 'es'] as const) {
  test(`file choices and network settings expose contextual help in ${lang}`, async ({ page }) => {
    await watchViolations(page);
    await page.goto('/index.html#settings');
    await page.locator(`input[name="language"][value="${lang}"]`).check();
    const strings = TABLES[lang];
    for (const base of DEFAULT_CALENDARS) {
      await expect(page.locator(`[id="network-${new URL(base).host}"]`)).toHaveAccessibleDescription(strings['settings.help.calendars']);
    }
    for (const base of DEFAULT_EXPLORERS) {
      await expect(page.locator(`[id="network-${new URL(base).host}"]`)).toHaveAccessibleDescription(strings['settings.help.explorers']);
    }
    await expect(page.locator('#min-cal')).toHaveAccessibleDescription(strings['settings.help.minimum']);
    await page.locator('nav a[href="#verify"]').click();
    const choices = [
      ['verify-file', 'verify.dropFileHint', 'help.verifyFile'],
      ['verify-receipt', 'verify.dropReceiptHint', 'help.verifyReceipt'],
      ['upgrade-receipt', 'verify.dropReceiptHint', 'help.upgradeReceipt'],
      ['batch-files', 'batch.fileHint', 'help.batchFiles'],
      ['batch-receipts', 'batch.receiptHint', 'help.batchReceipts'],
    ] as const;
    for (const [id, hint, help] of choices) {
      await expect(page.locator(`#${id}`)).toHaveAccessibleDescription(`${strings[hint]} ${strings[help]}`);
      await expect(page.locator(`#${id}-help`)).toBeVisible();
    }
    await page.locator('nav a[href="#stamp"]').click();
    const hint = strings['stamp.dropHint'].replace('{max}', String(MAX_STAMP_FILES));
    await expect(page.locator('#stamp-file')).toHaveAccessibleDescription(`${hint} ${strings['help.stampFiles']}`);
    expect(await cspViolations(page)).toEqual([]);
  });
}
