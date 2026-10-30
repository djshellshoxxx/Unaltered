import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { groupHex } from '../../src/core/bytes';
import { makeJpeg } from '../helpers/images';
import { bytesOf, cspViolations, installNetwork, sha256hex, watchViolations } from './helpers';

const NOTE = bytesOf('hello e2e');
const NOTE_HEX = sha256hex(NOTE);

async function stampNote(page: Page, name = 'note.txt', content: Buffer = NOTE): Promise<Buffer> {
  await page.goto('/index.html#stamp');
  await page.setInputFiles('#stamp-file', { name, mimeType: 'text/plain', buffer: content });
  await expect(page.locator('.digest').first()).toContainText(groupHex(sha256hex(content)));
  await page.getByLabel(/I understand and want to continue/).check();
  await page.getByRole('button', { name: 'Create receipt' }).click();
  const link = page.getByRole('link', { name: /Download receipt/ });
  await expect(link).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent('download'), link.click()]);
  expect(dl.suggestedFilename()).toBe(`${name}.ots`);
  return readFileSync((await dl.path())!);
}

test.describe('stamp, upgrade, verify (network mocked)', () => {
  test('full flow with the four mandatory trust behaviours', async ({ page, context }) => {
    const chain = await installNetwork(context);
    const viol = await watchViolations(page);

    const pending = await stampNote(page);
    // privacy: only the nonce-blinded commitment reached the calendars, never the file digest
    expect(chain.digestPosts).toHaveLength(3);
    expect(new Set(chain.digestPosts).size).toBe(1);
    expect(chain.digestPosts[0]).not.toBe(NOTE_HEX);
    await expect(page.getByText('Pending: not yet proof.')).toBeVisible();
    await expect(page.getByText("We do not store it").first()).toBeVisible();

    // verify: pending receipt is NEVER a match
    await page.goto('/index.html#verify');
    await page.setInputFiles('#verify-file', { name: 'note.txt', mimeType: 'text/plain', buffer: NOTE });
    await page.setInputFiles('#verify-receipt', { name: 'note.txt.ots', mimeType: 'application/octet-stream', buffer: pending });
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.locator('.result-PENDING')).toContainText('Not yet confirmed');
    await expect(page.locator('.result-VERIFIED')).toHaveCount(0);

    // upgrade while calendars still answer 404
    await page.setInputFiles('#upgrade-receipt', { name: 'note.txt.ots', mimeType: 'application/octet-stream', buffer: pending });
    await page.getByRole('button', { name: 'Check for confirmation' }).click();
    await expect(page.getByText('Not confirmed yet')).toBeVisible();
    await expect(page.getByText('This browser could not read the answer')).toBeVisible();
    await expect(page.getByRole('link', { name: /Download upgraded receipt/ })).toHaveCount(0);

    // Bitcoin confirms
    chain.confirmed = true;
    await page.getByRole('button', { name: 'Check for confirmation' }).click();
    const dlLink = page.getByRole('link', { name: /Download upgraded receipt/ });
    await expect(dlLink).toBeVisible();
    await expect(page.getByText('Your original receipt was not changed')).toBeVisible();
    const [dl] = await Promise.all([page.waitForEvent('download'), dlLink.click()]);
    const upgraded = readFileSync((await dl.path())!);
    expect(upgraded.length).toBeGreaterThan(pending.length - 200);

    // verify upgraded receipt: VERIFIED with trust level on the same screen
    await page.setInputFiles('#verify-receipt', { name: 'note.upgraded.ots', mimeType: 'application/octet-stream', buffer: upgraded });
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.locator('.result-VERIFIED')).toContainText('Verified');
    await expect(page.locator('.result-VERIFIED')).toContainText('Trust level L1');
    await expect(page.locator('.result-VERIFIED')).toContainText('no later than about');
    await expect(page.locator('.result-VERIFIED')).toContainText('mempool.space');

    // mutated file -> NO_MATCH
    await page.setInputFiles('#verify-file', { name: 'note.txt', mimeType: 'text/plain', buffer: bytesOf('hello e2f') });
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.locator('.result-NO_MATCH_FILE')).toBeVisible();

    // mutated receipt -> never verified
    const bad = Buffer.from(upgraded);
    bad[bad.length - 20] = bad[bad.length - 20]! ^ 0x40;
    await page.setInputFiles('#verify-file', { name: 'note.txt', mimeType: 'text/plain', buffer: NOTE });
    await page.setInputFiles('#verify-receipt', { name: 'bad.ots', mimeType: 'application/octet-stream', buffer: bad });
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.locator('.result')).toBeVisible();
    await expect(page.locator('.result-VERIFIED')).toHaveCount(0);

    // explorers disagree -> do not trust
    chain.skew.add('mempool.space');
    await page.setInputFiles('#verify-receipt', { name: 'note.upgraded.ots', mimeType: 'application/octet-stream', buffer: upgraded });
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.locator('.result-SOURCES_DISAGREE')).toContainText('sources disagree');

    expect(await cspViolations(page)).toEqual([]);
    expect(viol.list).toEqual([]);
  });

  test('a readable pending 404 shows only the pending notice', async ({ page, context }) => {
    await installNetwork(context, { pendingCors: true });
    const pending = await stampNote(page);
    await page.goto('/index.html#verify');
    await page.setInputFiles('#upgrade-receipt', { name: 'n.ots', mimeType: 'application/octet-stream', buffer: pending });
    await page.getByRole('button', { name: 'Check for confirmation' }).click();
    await expect(page.getByText('Not confirmed yet')).toBeVisible();
    await expect(page.getByText('This browser could not read the answer')).toHaveCount(0);
    await expect(page.locator('.upgrade-result ul.calendars')).toHaveCount(0);
  });

  test('share link pre-fills the fingerprint and verifies without the file', async ({ page, context }) => {
    const chain = await installNetwork(context, { confirm: true });
    const pending = await stampNote(page);
    await page.goto('/index.html#verify');
    await page.setInputFiles('#upgrade-receipt', { name: 'n.ots', mimeType: 'application/octet-stream', buffer: pending });
    await page.getByRole('button', { name: 'Check for confirmation' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Download upgraded receipt/ }).click()]);
    const upgraded = readFileSync((await dl.path())!);
    expect(chain.timestampGets.length).toBeGreaterThan(0);

    await page.goto(`/index.html#h=${NOTE_HEX}`);
    await expect(page.getByRole('heading', { name: 'Check a file against a receipt.' })).toBeVisible();
    await expect(page.locator('.digest').first()).toContainText(groupHex(NOTE_HEX));
    await page.setInputFiles('#verify-receipt', { name: 'n.ots', mimeType: 'application/octet-stream', buffer: upgraded });
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.locator('.result-VERIFIED')).toBeVisible();
    // the share link carries only the fingerprint
    expect(page.url()).not.toContain('note');
  });

  test('batch stamping yields one receipt per file', async ({ page, context }) => {
    const chain = await installNetwork(context);
    await page.goto('/index.html#stamp');
    await page.setInputFiles('#stamp-file', [1, 2, 3].map((i) => ({ name: `f${i}.txt`, mimeType: 'text/plain', buffer: bytesOf(`file ${i}`) })));
    await expect(page.locator('.item .digest')).toHaveCount(3);
    for (const box of await page.getByLabel(/I understand and want to continue/).all()) await box.check();
    await page.getByRole('button', { name: 'Create 3 receipts' }).click();
    await expect(page.getByRole('link', { name: /Download receipt/ })).toHaveCount(3);
    expect(chain.digestPosts).toHaveLength(3); // one merkle tip to each of the three calendars
    expect(new Set(chain.digestPosts).size).toBe(1);
  });

  test('calendar failure below M reports which servers failed', async ({ page, context }) => {
    await installNetwork(context);
    await context.route('https://bob.btc.calendar.opentimestamps.org/**', (r) => r.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, body: 'x' }));
    await context.route('https://finney.calendar.eternitywall.com/**', (r) => r.abort());
    await page.goto('/index.html#stamp');
    await page.setInputFiles('#stamp-file', { name: 'a.txt', mimeType: 'text/plain', buffer: NOTE });
    await page.getByLabel(/I understand and want to continue/).check();
    await page.getByRole('button', { name: 'Create receipt' }).click();
    await expect(page.getByRole('alert')).toContainText('required calendar servers');
    await expect(page.locator('.calendars li')).toHaveCount(3);
    await expect(page.getByRole('link', { name: /Download receipt/ })).toHaveCount(0);
  });
});

test.describe('metadata stripping in a real browser', () => {
  test('cleaned JPEG must be downloaded first, has no EXIF/GPS and still decodes', async ({ page }) => {
    await page.goto('/index.html#stamp');
    // Real JPEG from the browser's own encoder, then a synthetic EXIF block spliced in.
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const g = c.getContext('2d')!;
      g.fillStyle = '#c33';
      g.fillRect(0, 0, 16, 16);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (const x of buf) s += String.fromCharCode(x);
      return btoa(s);
    });
    const real = Buffer.from(b64, 'base64');
    const exif = makeJpeg({ exif: { orientation: 1, gps: true } });
    // extract the APP1 segment from the synthetic one and splice it after SOI of the real image
    const app1Start = exif.findIndex((v, i) => v === 0xff && exif[i + 1] === 0xe1);
    const app1Len = (exif[app1Start + 2]! << 8) | exif[app1Start + 3]!;
    const app1 = Buffer.from(exif.slice(app1Start, app1Start + 2 + app1Len));
    const dirty = Buffer.concat([real.subarray(0, 2), app1, real.subarray(2), Buffer.from('SECRET-TRAILING')]);
    expect(dirty.includes('SECRET-GPS-LOCATION')).toBe(true);

    await page.setInputFiles('#stamp-file', { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: dirty });
    await expect(page.getByText('The receipt applies only to the cleaned copy')).toBeVisible();
    await expect(page.getByText('including GPS location')).toBeVisible();
    // Create is disabled until the cleaned copy is downloaded
    const create = page.getByRole('button', { name: 'Create receipt' });
    await expect(create).toBeDisabled();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Download cleaned copy/ }).click()]);
    expect(dl.suggestedFilename()).toBe('photo-cleaned.jpg');
    const cleaned = readFileSync((await dl.path())!);
    expect(cleaned.includes('SECRET-GPS-LOCATION')).toBe(false);
    expect(cleaned.includes('Exif')).toBe(false);
    expect(cleaned.includes('SECRET-TRAILING')).toBe(false);
    await expect(create).toBeEnabled();
    // the fingerprint on screen is of the CLEANED copy
    await expect(page.locator('.digest').first()).toContainText(groupHex(sha256hex(cleaned)));
    // still a valid picture
    const ok = await page.evaluate(async (b) => {
      const bytes = Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
      return bmp.width === 16 && bmp.height === 16;
    }, cleaned.toString('base64'));
    expect(ok).toBe(true);
  });

  test('unsupported types need an explicit acknowledgement and never claim to be clean', async ({ page }) => {
    await page.goto('/index.html#stamp');
    await page.setInputFiles('#stamp-file', { name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%fake') });
    await expect(page.getByText('This file type may contain hidden data we cannot remove', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create receipt' })).toBeDisabled();
    await page.getByLabel(/I understand and want to continue/).check();
    await expect(page.getByRole('button', { name: 'Create receipt' })).toBeEnabled();
    await expect(page.getByText(/is clean|no hidden data/i)).toHaveCount(0);
  });

  test('a damaged image is refused', async ({ page }) => {
    await page.goto('/index.html#stamp');
    await page.setInputFiles('#stamp-file', { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(makeJpeg({ noEoi: true })) });
    await expect(page.getByRole('alert')).toContainText('damaged or unsafe');
    await expect(page.getByRole('button', { name: 'Create receipt' })).toBeDisabled();
  });
});

test.describe('platform behaviour', () => {
  test('works offline from a local file (single-file build) and without any network request', async ({ browser }) => {
    const ctx = await browser.newContext({ offline: true });
    const page = await ctx.newPage();
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await watchViolations(page);
    const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;
    const file = pathToFileURL(resolve('dist', `unaltered-${version}.html`)).href;
    await page.goto(`${file}#stamp`);
    await page.setInputFiles('#stamp-file', { name: 'offline.txt', mimeType: 'text/plain', buffer: NOTE });
    await expect(page.locator('.digest').first()).toContainText(groupHex(NOTE_HEX));
    expect(await cspViolations(page)).toEqual([]);
    expect(requests.filter((u) => /^https?:/.test(u))).toEqual([]);
    await ctx.close();
  });

  test('multi-file build loads under SRI and strict CSP with no violations', async ({ page }) => {
    const viol = await watchViolations(page);
    await page.goto('/index.html');
    await expect(page.locator('#build-hash')).toHaveText(/^[0-9a-f]{16}$/);
    await page.setInputFiles('#stamp-file', { name: 'x.txt', mimeType: 'text/plain', buffer: NOTE });
    await expect(page.locator('.digest').first()).toBeVisible();
    expect(await cspViolations(page)).toEqual([]);
    expect(viol.list).toEqual([]);
  });

  test('hashes in a Web Worker without blocking the main thread', async ({ page }) => {
    await page.goto('/index.html');
    const res = await page.evaluate(async () => {
      const big = new File([new Uint8Array(48 * 1024 * 1024)], 'big.bin');
      await new Promise((r) => setTimeout(r, 100));
      const start = performance.now();
      const phases: { phase: string; ms: number }[] = [];
      const mark = (phase: string): void => { if (phases.length < 100) phases.push({ phase, ms: performance.now() - start }); };
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(...args: ConstructorParameters<typeof Worker>) {
          mark('worker-constructor-start');
          super(...args);
          mark('worker-constructor-end');
          this.addEventListener('message', (event: MessageEvent<{ type?: string }>) => mark(`worker-${event.data.type ?? 'unknown'}`));
        }
        override terminate(): void {
          mark('worker-terminate-start');
          super.terminate();
          mark('worker-terminate-end');
        }
      };
      const arrayBuffer = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = async function (): Promise<ArrayBuffer> {
        mark(`main-blob-${this.size}-read-start`);
        const result = await arrayBuffer.call(this);
        mark(`main-blob-${this.size}-read-end`);
        return result;
      };
      let maxGap = 0;
      const gaps: { gap: number; ms: number; phase: string | undefined }[] = [];
      let last = performance.now();
      const timer = setInterval(() => {
        const n = performance.now();
        maxGap = Math.max(maxGap, n - last);
        if (n - last >= 50 && gaps.length < 20) gaps.push({ gap: n - last, ms: n - start, phase: phases.at(-1)?.phase });
        last = n;
      }, 5);
      const input = document.getElementById('stamp-file') as HTMLInputElement;
      mark('fixture-transfer-start');
      const dt = new DataTransfer();
      dt.items.add(big);
      mark('fixture-transfer-added');
      input.files = dt.files;
      mark('fixture-assigned');
      input.dispatchEvent(new Event('change', { bubbles: true }));
      mark('change-dispatched');
      for (let i = 0; i < 600 && !document.querySelector('.item .digest'); i++) await new Promise((r) => setTimeout(r, 20));
      clearInterval(timer);
      return { maxGap, phases, gaps, digest: document.querySelector('.item .digest')?.textContent ?? '' };
    });
    // sha256 of 48 MiB of zero bytes
    expect(res.digest.replace(/ /g, '')).toHaveLength(64);
    expect(res.maxGap, JSON.stringify({ phases: res.phases, gaps: res.gaps })).toBeLessThan(50);
  });

  test('opt-in receipt list and language switch', async ({ page, context }) => {
    await installNetwork(context);
    await page.goto('/index.html#settings');
    expect(await page.evaluate(() => localStorage.length)).toBe(0); // NFR-6: nothing stored by default
    await page.getByLabel('Remember my receipts on this device').check();
    await page.goto('/index.html#stamp');
    await page.setInputFiles('#stamp-file', { name: 'n.txt', mimeType: 'text/plain', buffer: NOTE });
    await page.getByLabel(/I understand and want to continue/).check();
    await page.getByRole('button', { name: 'Create receipt' }).click();
    await page.getByLabel('Label (optional)').fill('my note');
    await page.getByRole('button', { name: 'Save to list on this device' }).click();
    await page.goto('/index.html#settings');
    await expect(page.locator('.receipt-list')).toContainText('my note');
    const stored = await page.evaluate(() => JSON.stringify(Object.values(localStorage)));
    expect(stored).not.toContain('n.txt'); // file names are never stored
    await page.getByLabel('Remember my receipts on this device').uncheck();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);

    await page.getByRole('radio', { name: 'English', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('radio', { name: 'Español', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('radio', { name: 'English', exact: true })).toBeFocused();
    await page.getByRole('radio', { name: 'Español', exact: true }).check();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('radio', { name: 'English', exact: true })).toBeChecked();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });

  test('settings: custom calendar selection and minimum are honoured', async ({ page, context }) => {
    const chain = await installNetwork(context);
    await page.goto('/index.html#settings');
    await page.getByLabel('bob.btc.calendar.opentimestamps.org').uncheck();
    await page.getByLabel('finney.calendar.eternitywall.com').uncheck();
    await page.getByLabel('Calendars that must accept (minimum 1)').fill('1');
    await page.getByLabel('Calendars that must accept (minimum 1)').dispatchEvent('change');
    await expect(page.getByText('Custom endpoints change who sees your activity.')).toBeVisible();
    await page.goto('/index.html#stamp');
    await page.setInputFiles('#stamp-file', { name: 'n.txt', mimeType: 'text/plain', buffer: NOTE });
    await page.getByLabel(/I understand and want to continue/).check();
    await page.getByRole('button', { name: 'Create receipt' }).click();
    await expect(page.getByRole('link', { name: /Download receipt/ })).toBeVisible();
    expect(chain.digestPosts).toHaveLength(1);
  });

  test('refuses to run inside a frame', async ({ page }) => {
    await page.route('http://127.0.0.1:4173/parent.html', (r) => r.fulfill({ contentType: 'text/html', body: '<iframe src="/index.html" width="600" height="400"></iframe>' }));
    await page.goto('/parent.html');
    const frame = page.frameLocator('iframe');
    await expect(frame.getByRole('alert')).toContainText('inside another page');
  });
});

test.describe('accessibility (WCAG 2.2 AA)', () => {
  for (const view of ['stamp', 'verify', 'about', 'settings']) {
    test(`axe: ${view}`, async ({ page }) => {
      await page.goto(`/index.html#${view}`);
      await page.waitForSelector(`#${view} h2`);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  }

  test('keyboard: skip link first, nav reachable, file inputs focusable and labelled', async ({ page }) => {
    await page.goto('/index.html');
    await page.keyboard.press('Tab');
    await expect(page.locator('#skip')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#nav-stamp')).toBeFocused();
    await page.locator('#stamp-file').focus();
    await expect(page.locator('#stamp-file')).toBeFocused();
    expect(await page.locator('#stamp-file').evaluate((n) => (n as HTMLInputElement).labels?.length)).toBeGreaterThan(0);
  });

  test('touch targets are at least 44px at 360px width', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/index.html#settings');
    const small = await page.evaluate(() => {
      const bad: string[] = [];
      for (const n of document.querySelectorAll('a, button, select, input:not(.file-input)')) {
        const input = n as HTMLInputElement;
        // Associated native labels are part of the clickable target, for checkboxes and radios alike.
        const target = n.tagName === 'INPUT' && (input.type === 'checkbox' || input.type === 'radio') ? input.labels?.[0] ?? n : n;
        const r = (target as HTMLElement).getBoundingClientRect();
        if (r.width > 0 && (r.height < 43.5 || r.width < 43.5)) bad.push(`${n.tagName} ${n.textContent?.slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return bad;
    });
    expect(small).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const spanishLabel = page.locator('#lang label').filter({ has: page.getByRole('radio', { name: 'Español', exact: true }) });
    const box = await spanishLabel.boundingBox();
    expect(box).not.toBeNull();
    await spanishLabel.click({ position: { x: box!.width - 2, y: box!.height / 2 } });
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });
});
