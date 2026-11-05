import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { collectAttestations, parseProof, serializeProof, serializeTree } from '../../src/core/ots/codec';
import type { TsNode } from '../../src/core/ots/types';
import { cspViolations, watchViolations } from './helpers';

// Synthetic receipt only: distinct append/prepend paths converge on the same commitment. No real anchoring claimed.
test('converging commitments upgrade all matching pending targets with one browser request', async ({ page, context }) => {
  const digest = new Uint8Array(32);
  const commitment = new Uint8Array(33);
  const calendar = 'https://alice.btc.calendar.opentimestamps.org';
  const pending = (uri: string): TsNode => ({ msg: commitment, children: [], attestations: [{ kind: 'pending', uri }] });
  const original = Buffer.from(serializeProof({ digest, root: { msg: digest, attestations: [], children: [
    { op: { kind: 'append', arg: Uint8Array.of(0) }, node: pending(calendar) },
    { op: { kind: 'prepend', arg: Uint8Array.of(0) }, node: pending(calendar.toUpperCase()) },
  ] } }));
  const merkle = Uint8Array.from(createHash('sha256').update(commitment).digest());
  const response = serializeTree({ msg: commitment, attestations: [], children: [
    { op: { kind: 'sha256' }, node: { msg: merkle, children: [], attestations: [{ kind: 'bitcoin', height: 800_000 }] } },
  ] });
  const requests: string[] = [];
  await context.route(`${calendar}/timestamp/**`, async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: Buffer.from(response) });
  });
  const errors = await watchViolations(page);
  await page.goto('/Unaltered/index.html#verify');
  await page.setInputFiles('#upgrade-receipt', { name: 'converging.ots', mimeType: 'application/octet-stream', buffer: original });
  await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();
  const link = page.locator('.upgrade-result a[download]');
  await expect(link).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  const upgraded = parseProof(new Uint8Array(readFileSync((await download.path())!)));
  expect(upgraded.digest).toEqual(digest);
  const leaves = collectAttestations(upgraded.root);
  expect(leaves.filter((leaf) => leaf.attestation.kind === 'pending')).toHaveLength(0);
  expect(leaves.filter((leaf) => leaf.attestation.kind === 'bitcoin')).toHaveLength(2);
  expect(collectAttestations(parseProof(original).root).filter((leaf) => leaf.attestation.kind === 'pending')).toHaveLength(2);
  expect(requests).toEqual([`${calendar}/timestamp/${Buffer.from(commitment).toString('hex')}`]);
  await expect(page.locator('.upgrade-result')).toContainText('then use Verify with the original file');
  await expect(page.locator('.result-VERIFIED')).toHaveCount(0);
  expect(errors.list).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
});
