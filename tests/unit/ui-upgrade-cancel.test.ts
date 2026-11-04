import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnalteredError } from '../../src/core/errors';
import { upgrade } from '../../src/core/ots/calendar';
import { serializeProof } from '../../src/core/ots/codec';
import { mountVerify } from '../../src/ui/views/verify';
import { t } from '../../src/ui/strings';
import { doc, type FElement, installFakeDom } from './ui-fake-dom';

vi.mock('../../src/core/ots/calendar', async (original) => ({ ...await original<typeof import('../../src/core/ots/calendar')>(), upgrade: vi.fn() }));

let restore: () => void;
let root: FElement;
const signals: AbortSignal[] = [];
beforeEach(() => {
  restore = installFakeDom();
  root = doc.createElement('section');
  doc.body.appendChild(root);
  mountVerify(root as never);
  signals.length = 0;
  vi.mocked(upgrade).mockImplementation((_bytes, cfg) => {
    if (cfg.signal) signals.push(cfg.signal);
    return new Promise((_resolve, reject) => cfg.signal?.addEventListener('abort', () => reject(new UnalteredError('ABORTED', 'Cancelled.')), { once: true }));
  });
});
afterEach(() => { restore(); vi.clearAllMocks(); });

function choose(name = 'pending.ots'): void {
  const digest = new Uint8Array(32);
  const bytes = serializeProof({ digest, root: { msg: digest, children: [], attestations: [{ kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' }] } });
  const input = root.querySelector('#upgrade-receipt')!;
  input.files = [{ name, size: bytes.length, arrayBuffer: async () => bytes.slice().buffer }];
  input.dispatch('change');
}
const button = (label: string): FElement | undefined => root.all().find((n) => n.tagName === 'BUTTON' && n.textContent === label);
async function run(): Promise<void> {
  button(t('upgrade.run'))!.dispatch('click');
  await vi.waitFor(() => expect(signals).toHaveLength(1));
}

describe('upgrade lifecycle', () => {
  it('does not start overlapping upgrade requests when pressed repeatedly', async () => {
    choose();
    await run();
    button(t('upgrade.run'))!.dispatch('click');
    await Promise.resolve();
    expect(upgrade).toHaveBeenCalledTimes(1);
    expect(button(t('upgrade.run'))!.disabled).toBe(true);
  });
  it('aborts the obsolete calendar request when the receipt is replaced', async () => {
    choose();
    await run();
    choose('replacement.ots');
    expect(signals[0]!.aborted).toBe(true);
    await Promise.resolve();
    expect(root.textContent).not.toContain('Cancelled.');
    expect(button(t('upgrade.run'))!.disabled).toBe(false);
  });
  it('offers cancellation and permits a fresh request afterwards', async () => {
    choose();
    await run();
    expect(button(t('common.cancel'))).toBeDefined();
    button(t('common.cancel'))!.dispatch('click');
    expect(signals[0]!.aborted).toBe(true);
    await Promise.resolve();
    expect(button(t('upgrade.run'))!.disabled).toBe(false);
    button(t('upgrade.run'))!.dispatch('click');
    await vi.waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[1]!.aborted).toBe(false);
    button(t('common.cancel'))!.dispatch('click');
  });
  it('keeps keyboard focus on the available action when starting and cancelling', async () => {
    choose();
    button(t('upgrade.run'))!.focus();
    await run();
    expect(doc.activeElement).toBe(button(t('common.cancel')));
    button(t('common.cancel'))!.dispatch('click');
    expect(doc.activeElement).toBe(button(t('upgrade.run')));
  });
  it('ignores a late success while the replacement request is running', async () => {
    let complete!: (result: Awaited<ReturnType<typeof upgrade>>) => void;
    vi.mocked(upgrade).mockImplementationOnce((_bytes, cfg) => {
      signals.push(cfg.signal!);
      return new Promise((resolve) => { complete = resolve; });
    });
    choose();
    await run();
    button(t('common.cancel'))!.dispatch('click');
    button(t('upgrade.run'))!.dispatch('click');
    await vi.waitFor(() => expect(signals).toHaveLength(2));
    complete({ ots: new Uint8Array(), status: 'pending', changed: false, unknownCalendars: [], calendars: [] });
    await Promise.resolve();
    expect(button(t('upgrade.run'))!.disabled).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
    expect(root.querySelector('.upgrade-result')!.textContent).toBe(t('verify.working'));
    button(t('common.cancel'))!.dispatch('click');
  });
});
