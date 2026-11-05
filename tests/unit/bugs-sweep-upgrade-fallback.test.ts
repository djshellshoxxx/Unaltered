import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { upgrade, type UpgradeResult } from '../../src/core/ots/calendar';
import { serializeProof } from '../../src/core/ots/codec';
import { mountVerify, type VerifyView } from '../../src/ui/views/verify';
import { revokeAll } from '../../src/ui/download';
import { setLang, t } from '../../src/ui/strings';
import { doc, type FElement, installFakeDom } from './ui-fake-dom';

vi.mock('../../src/core/ots/calendar', async (original) => ({ ...await original<typeof import('../../src/core/ots/calendar')>(), upgrade: vi.fn() }));
let restore: () => void;
let root: FElement;
let view: VerifyView;
const digest = new Uint8Array(32);
const bytes = serializeProof({ digest, root: { msg: digest, children: [], attestations: [{ kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' }] } });
beforeEach(() => {
  setLang('en');
  restore = installFakeDom();
  root = doc.createElement('section');
  doc.body.appendChild(root);
  view = mountVerify(root as never);
});
afterEach(() => { revokeAll(); restore(); setLang('en'); vi.clearAllMocks(); });

async function run(overrides: Partial<UpgradeResult> = {}): Promise<void> {
  vi.mocked(upgrade).mockResolvedValue({ ots: bytes, status: 'pending', changed: false, unknownCalendars: [],
    calendars: [{ url: 'https://alice.btc.calendar.opentimestamps.org', ok: false, unreadable: true, error: 'Could not read response.' }], ...overrides });
  const picker = root.querySelector('#upgrade-receipt')!;
  picker.files = [{ name: 'receipt-$(untrusted).ots', size: bytes.length, arrayBuffer: async () => bytes.slice().buffer }];
  picker.dispatch('change');
  root.querySelector('#upgrade-run')!.dispatch('click');
  await vi.waitFor(() => expect(upgrade).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(root.querySelector('.upgrade-result')!.textContent).toContain(t('upgrade.stillPending')));
}

describe('reference-client fallback for unreadable pending upgrade responses', () => {
  for (const changed of [false, true]) {
    it(`offers a fixed safe command with honest network/trust guidance when changed=${changed}`, async () => {
      await run({ changed });
      const fallback = root.querySelector('.reference-upgrade');
      expect(fallback).not.toBeNull();
      expect(fallback!.querySelector('pre')?.textContent).toBe('ots upgrade receipt.ots');
      expect(fallback!.querySelector('pre')?.getAttribute('aria-label')).toBe('Reference client upgrade command');
      expect(fallback!.textContent).toContain('network access');
      expect(fallback!.textContent).toContain('backup');
      expect(fallback!.textContent).toContain('own Bitcoin node (L2)');
      expect(root.querySelector('.result-VERIFIED')).toBeNull();
      const downloads = root.all().filter((node) => node.tagName === 'A' && node.getAttribute('download') !== null);
      expect(downloads).toHaveLength(changed ? 1 : 0);
      if (changed) expect(root.textContent).toContain(t('upgrade.newFile'));
    });
  }

  it('relabels the fallback without repeating network work', async () => {
    await run();
    setLang('es');
    view.relabel();
    expect(root.querySelector('.reference-upgrade')?.textContent).toContain('Actualizar con el cliente de referencia');
    expect(root.querySelector('.reference-upgrade')?.querySelector('pre')?.textContent).toBe('ots upgrade receipt.ots');
    expect(upgrade).toHaveBeenCalledTimes(1);
  });

  it('keeps ordinary readable pending results concise', async () => {
    await run({ calendars: [] });
    expect(root.querySelector('.reference-upgrade')).toBeNull();
  });
});
