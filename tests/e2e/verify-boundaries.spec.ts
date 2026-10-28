import { expect, test, type Page } from '@playwright/test';
import { fromHex } from '../../src/core/bytes';
import { serializeProof, serializeTree } from '../../src/core/ots/codec';
import { LIMITS } from '../../src/core/ots/types';
import { sha256hex } from './helpers';

const HEX = sha256hex(Buffer.from('lifecycle fixture'));
const digest = fromHex(HEX);
// Unknown calendars are inert: these fixtures exercise UI completion without a network dependency.
const PENDING = Buffer.from(serializeProof({ digest, root: {
  msg: digest, children: [], attestations: [{ kind: 'pending', uri: 'https://untrusted.example' }],
} }));
const receipt = (name: string, buffer = PENDING): { name: string; mimeType: string; buffer: Buffer } => ({ name, mimeType: 'application/octet-stream', buffer });

interface ReadGate {
  reads: string[];
  release?: () => void;
}

async function holdReceiptRead(page: Page): Promise<void> {
  await page.evaluate(() => {
    const gate: ReadGate = { reads: [] };
    (window as unknown as { __receiptGate: ReadGate }).__receiptGate = gate;
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function (): Promise<ArrayBuffer> {
      gate.reads.push(this.name);
      const bytes = await read.call(this);
      if (this.name === 'held.ots') await new Promise<void>((resolve) => { gate.release = resolve; });
      return bytes;
    };
  });
}

async function waitForHeldRead(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as unknown as { __receiptGate: ReadGate }).__receiptGate.release);
}

async function releaseReceiptRead(page: Page): Promise<void> {
  await page.evaluate(async () => {
    (window as unknown as { __receiptGate: ReadGate }).__receiptGate.release!();
    // The inert proof has only finite microtask continuations after File.arrayBuffer resolves.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

interface NetworkGate { releases: (() => void)[] }

async function holdNetworkResponse(page: Page, body = '', status = 404): Promise<void> {
  await page.evaluate(({ body, status }) => {
    const gate: NetworkGate = { releases: [] };
    (window as unknown as { __networkGate: NetworkGate }).__networkGate = gate;
    // Synthetic responses only: deliberately let an issued request finish after input replacement.
    window.fetch = async (): Promise<Response> => {
      await new Promise<void>((resolve) => gate.releases.push(resolve));
      return new Response(Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0)), { status });
    };
  }, { body, status });
}

async function releaseNetworkResponses(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (const release of (window as unknown as { __networkGate: NetworkGate }).__networkGate.releases) release();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

test.describe('receipt input boundaries', () => {
  for (const action of ['verify', 'upgrade'] as const) {
    for (const extra of [0, 1]) {
      test(`${action}: ${extra ? 'reject over-limit receipt before reading' : 'read receipt at the exact limit'}`, async ({ page }) => {
        await page.goto(`/index.html#h=${HEX}`);
        await holdReceiptRead(page);
        const id = action === 'verify' ? '#verify-receipt' : '#upgrade-receipt';
        await page.setInputFiles(id, receipt('boundary.ots', Buffer.alloc(LIMITS.maxInputBytes + extra)));
        await page.getByRole('button', { name: action === 'verify' ? 'Check' : 'Check for confirmation', exact: true }).click();
        const output = page.locator(action === 'verify' ? '.verify-result' : '.upgrade-result');
        await expect(output).toContainText(extra ? 'The receipt file is too large.' : 'This is not an OpenTimestamps receipt.');
        const reads = await page.evaluate(() => (window as unknown as { __receiptGate: ReadGate }).__receiptGate.reads);
        expect(reads).toEqual(extra ? [] : ['boundary.ots']);
      });
    }
  }
});

test.describe('verification completion ownership', () => {
  for (const change of ['cancel', 'receipt', 'file', 'fingerprint', 'remove fingerprint'] as const) {
    test(`a held completion cannot publish after ${change}`, async ({ page }) => {
      await page.goto(`/index.html#h=${HEX}`);
      await holdReceiptRead(page);
      await page.setInputFiles('#verify-receipt', receipt('held.ots'));
      await page.getByRole('button', { name: 'Check', exact: true }).click();
      await waitForHeldRead(page);
      if (change === 'cancel') await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      else if (change === 'receipt') await page.setInputFiles('#verify-receipt', receipt('new.ots', Buffer.from('invalid')));
      else if (change === 'file') await page.setInputFiles('#verify-file', { name: 'different.txt', mimeType: 'text/plain', buffer: Buffer.from('different') });
      else if (change === 'fingerprint') await page.goto(`/index.html#h=${'00'.repeat(32)}`);
      else await page.getByRole('button', { name: 'Remove', exact: true }).click();
      await releaseReceiptRead(page);
      await expect(page.locator('.verify-result')).toBeEmpty();
      const check = page.getByRole('button', { name: 'Check', exact: true });
      if (change === 'remove fingerprint') await expect(check).toBeDisabled();
      else await expect(check).toBeEnabled();
    });
  }

  test('a superseded read cannot replace a newer result or clear its actions', async ({ page }) => {
    await page.goto(`/index.html#h=${HEX}`);
    await holdReceiptRead(page);
    await page.setInputFiles('#verify-receipt', receipt('held.ots'));
    await page.getByRole('button', { name: 'Check', exact: true }).click({ timeout: 5000 });
    await waitForHeldRead(page);
    await page.setInputFiles('#verify-receipt', receipt('new.ots', Buffer.from('invalid')));
    await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.locator('.result-INVALID_PROOF')).toBeVisible();
    await releaseReceiptRead(page);
    await expect(page.locator('.result-INVALID_PROOF')).toBeVisible();
    await expect(page.locator('.result-PENDING')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeEnabled();
  });

  // A superseded operation's result is discarded, so its signal must also stop the hash worker and requests it owns.
  for (const change of ['cancel', 'receipt', 'file', 'fingerprint', 'remove fingerprint'] as const) {
    test(`a superseded verification is aborted after ${change}`, async ({ page }) => {
      await page.goto(`/index.html#h=${HEX}`);
      await holdReceiptRead(page);
      await page.evaluate(() => {
        const created: AbortController[] = [];
        (window as unknown as { __controllers: AbortController[] }).__controllers = created;
        const Original = window.AbortController;
        window.AbortController = class extends Original {
          constructor() {
            super();
            created.push(this);
          }
        };
      });
      await page.setInputFiles('#verify-receipt', receipt('held.ots'));
      await page.getByRole('button', { name: 'Check', exact: true }).click();
      await waitForHeldRead(page);
      expect(await page.evaluate(() => (window as unknown as { __controllers: AbortController[] }).__controllers.map((c) => c.signal.aborted))).toEqual([false]);
      if (change === 'cancel') await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      else if (change === 'receipt') await page.setInputFiles('#verify-receipt', receipt('new.ots', Buffer.from('invalid')));
      else if (change === 'file') await page.setInputFiles('#verify-file', { name: 'different.txt', mimeType: 'text/plain', buffer: Buffer.from('different') });
      else if (change === 'fingerprint') await page.goto(`/index.html#h=${'00'.repeat(32)}`);
      else await page.getByRole('button', { name: 'Remove', exact: true }).click();
      expect(await page.evaluate(() => (window as unknown as { __controllers: AbortController[] }).__controllers[0]!.signal.aborted)).toBe(true);
      await releaseReceiptRead(page);
      await expect(page.locator('.verify-result')).toBeEmpty();
    });
  }
});

test('held network verification cannot replace a newer result', async ({ page }) => {
  await page.goto(`/index.html#h=${HEX}`);
  await holdNetworkResponse(page);
  const bitcoin = Buffer.from(serializeProof({ digest, root: { msg: digest, children: [], attestations: [{ kind: 'bitcoin', height: 1 }] } }));
  await page.setInputFiles('#verify-receipt', receipt('bitcoin.ots', bitcoin));
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.waitForFunction(() => (window as unknown as { __networkGate: NetworkGate }).__networkGate.releases.length === 2);
  await page.setInputFiles('#verify-receipt', receipt('new.ots', Buffer.from('invalid')));
  await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.locator('.result-INVALID_PROOF')).toBeVisible();
  await releaseNetworkResponses(page);
  await expect(page.locator('.result-INVALID_PROOF')).toBeVisible();
  await expect(page.locator('.result-UNREACHABLE')).toHaveCount(0);
});

test('held network upgrade cannot create a download for a replaced receipt', async ({ page }) => {
  await page.goto('/index.html#verify');
  await holdNetworkResponse(page, Buffer.from(serializeTree({ msg: digest, children: [], attestations: [{ kind: 'bitcoin', height: 1 }] })).toString('base64'), 200);
  const pending = Buffer.from(serializeProof({ digest, root: { msg: digest, children: [], attestations: [{ kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' }] } }));
  await page.setInputFiles('#upgrade-receipt', receipt('pending.ots', pending));
  await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();
  await page.waitForFunction(() => (window as unknown as { __networkGate: NetworkGate }).__networkGate.releases.length === 1);
  await page.setInputFiles('#upgrade-receipt', receipt('new.ots', Buffer.from('invalid')));
  await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();
  await expect(page.locator('.upgrade-result [role=alert]')).toContainText('The receipt ends unexpectedly.');
  await releaseNetworkResponses(page);
  await expect(page.locator('.upgrade-result [role=alert]')).toContainText('The receipt ends unexpectedly.');
  await expect(page.locator('.upgrade-result a')).toHaveCount(0);
});

test('an older upgrade cannot replace the current receipt error', async ({ page }) => {
  await page.goto('/index.html#verify');
  await holdReceiptRead(page);
  await page.setInputFiles('#upgrade-receipt', receipt('held.ots'));
  await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();
  await waitForHeldRead(page);
  await page.setInputFiles('#upgrade-receipt', receipt('new.ots', Buffer.from('invalid')));
  await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();
  await expect(page.locator('.upgrade-result [role=alert]')).toContainText('The receipt ends unexpectedly.');
  await releaseReceiptRead(page);
  await expect(page.locator('.upgrade-result [role=alert]')).toContainText('The receipt ends unexpectedly.');
  await expect(page.locator('.upgrade-result')).not.toContainText('Not confirmed yet');
  await expect(page.locator('.upgrade-result a')).toHaveCount(0);
});

// Adapted from the independent PR #7 review (probe P4): the abort reaches the hash worker, not only the controller.
for (const change of ['cancel', 'receipt', 'file', 'fingerprint'] as const) {
  test(`a change during hashing terminates the superseded hash worker (${change})`, async ({ page }) => {
    await page.goto(`/index.html#h=${HEX}`);
    await holdReceiptRead(page);
    await page.evaluate(() => {
      const state = { workers: [] as boolean[], held: [] as (() => void)[] };
      (window as unknown as { __hashGate: typeof state }).__hashGate = state;
      const Original = window.Worker;
      window.Worker = class extends Original {
        private readonly index = state.workers.push(false) - 1;
        override terminate(): void {
          state.workers[this.index] = true;
          super.terminate();
        }
        override postMessage(message: unknown, transfer?: unknown): void {
          state.held.push(() => super.postMessage(message, transfer as Transferable[]));
        }
      } as typeof Worker;
    });
    await page.setInputFiles('#verify-file', { name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('lifecycle fixture') });
    await page.setInputFiles('#verify-receipt', receipt('r.ots'));
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await page.waitForFunction(() => (window as unknown as { __hashGate: { held: unknown[] } }).__hashGate.held.length === 1);
    if (change === 'cancel') await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    else if (change === 'receipt') await page.setInputFiles('#verify-receipt', receipt('r2.ots'));
    else if (change === 'file') await page.setInputFiles('#verify-file', { name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('b') });
    else await page.goto(`/index.html#h=${'00'.repeat(32)}`);
    expect(await page.evaluate(() => (window as unknown as { __hashGate: { workers: boolean[] } }).__hashGate.workers)).toEqual([true]);
    await page.evaluate(async () => {
      for (const go of (window as unknown as { __hashGate: { held: (() => void)[] } }).__hashGate.held.splice(0)) go();
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    });
    await expect(page.locator('.verify-result')).toBeEmpty();
    expect(await page.evaluate(() => (window as unknown as { __receiptGate: ReadGate }).__receiptGate.reads)).toEqual([]);
    await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeEnabled();
  });
}
