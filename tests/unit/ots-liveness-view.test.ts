// Verify view rendering of the R1 liveness canary (ADR-014). The canary is a hint about each calendar only: it never
// replaces the pending/unreadable notices, never claims the receipt is pending as fact, and never offers VERIFIED.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { upgrade, type CalendarResult, type UpgradeResult } from '../../src/core/ots/calendar';
import { serializeProof } from '../../src/core/ots/codec';
import { mountVerify, type VerifyView } from '../../src/ui/views/verify';
import { revokeAll } from '../../src/ui/download';
import { setLang, t } from '../../src/ui/strings';
import { doc, type FElement, installFakeDom } from './ui-fake-dom';

vi.mock('../../src/core/ots/calendar', async (original) => ({ ...await original<typeof import('../../src/core/ots/calendar')>(), upgrade: vi.fn() }));
let restore: () => void;
let root: FElement;
let view: VerifyView;
const ALICE = 'https://alice.btc.calendar.opentimestamps.org';
const BOB = 'https://bob.btc.calendar.opentimestamps.org';
const FINNEY = 'https://finney.calendar.eternitywall.com';
const digest = new Uint8Array(32);
const bytes = serializeProof({ digest, root: { msg: digest, children: [], attestations: [{ kind: 'pending', uri: ALICE }] } });
const unreadable = (url: string, liveness?: CalendarResult['liveness']): CalendarResult => ({
  url, ok: false, unreadable: true, error: 'Could not reach a server.', ...(liveness ? { liveness } : {}),
});

beforeEach(() => {
  setLang('en');
  restore = installFakeDom();
  root = doc.createElement('section');
  doc.body.appendChild(root);
  view = mountVerify(root as never);
});
afterEach(() => { revokeAll(); restore(); setLang('en'); vi.clearAllMocks(); });

async function run(overrides: Partial<UpgradeResult>, shown = t('upgrade.stillPending')): Promise<void> {
  vi.mocked(upgrade).mockResolvedValue({ ots: bytes, status: 'pending', changed: false, unknownCalendars: [], calendars: [], ...overrides });
  const picker = root.querySelector('#upgrade-receipt')!;
  picker.files = [{ name: 'pending.ots', size: bytes.length, arrayBuffer: async () => bytes.slice().buffer }];
  picker.dispatch('change');
  root.querySelector('#upgrade-run')!.dispatch('click');
  await vi.waitFor(() => expect(upgrade).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(root.querySelector('.upgrade-result')!.textContent).toContain(shown));
}

const items = (): string[] => root.querySelector('.upgrade-liveness')?.all().filter((n) => n.tagName === 'LI').map((n) => n.textContent) ?? [];

describe('liveness canary in the Verify view', () => {
  it('asks upgrade() for the canary', async () => {
    await run({ calendars: [unreadable(ALICE, 'reachable')] });
    expect(vi.mocked(upgrade).mock.calls[0]![1].liveness).toBe(true);
  });

  it('reports each unreadable calendar separately, with honest wording, and keeps the existing notices', async () => {
    await run({ calendars: [unreadable(ALICE, 'reachable'), unreadable(BOB, 'unreachable'), unreadable(FINNEY, 'unknown')] });
    const out = root.querySelector('.upgrade-result')!;
    expect(out.textContent).toContain(t('upgrade.unreadable'));
    expect(root.querySelector('.reference-upgrade')).not.toBeNull();
    expect(root.querySelector('.upgrade-liveness')!.textContent).toContain(t('upgrade.liveness.intro'));
    expect(items()).toEqual([
      t('upgrade.liveness.reachable', { host: 'alice.btc.calendar.opentimestamps.org' }),
      t('upgrade.liveness.unreachable', { host: 'bob.btc.calendar.opentimestamps.org' }),
      t('upgrade.liveness.unknown', { host: 'finney.calendar.eternitywall.com' }),
    ]);
    // Liveness lines are not notices: the existing notice list and calendar failure list are unchanged.
    expect(root.all().filter((n) => n.className.split(' ').includes('notice')).map((n) => n.textContent)).toEqual([t('upgrade.stillPending'), t('upgrade.unreadable')]);
    expect(root.querySelector('.result-VERIFIED')).toBeNull();
  });

  it('never states pending as fact and never calls a reachable calendar a confirmation', () => {
    for (const lang of ['en', 'es'] as const) {
      setLang(lang);
      const reachable = t('upgrade.liveness.reachable', { host: 'h' });
      expect(reachable).toMatch(lang === 'en' ? /probably/ : /probablemente/);
      for (const key of ['upgrade.liveness.intro', 'upgrade.liveness.reachable', 'upgrade.liveness.unreachable', 'upgrade.liveness.unknown'] as const) {
        expect(t(key, { host: 'h' })).not.toMatch(/\b(verified|confirmed|verificado|confirmado)\b/i);
      }
    }
  });

  it('lists calendars in a stable order whatever order their replies settled in', async () => {
    await run({ calendars: [unreadable(FINNEY, 'unknown'), unreadable(BOB, 'unreachable'), unreadable(ALICE, 'reachable')] });
    expect(items().map((s) => s.split(':')[0])).toEqual(['alice.btc.calendar.opentimestamps.org', 'bob.btc.calendar.opentimestamps.org', 'finney.calendar.eternitywall.com']);
  });

  it('shows one line per calendar even when the result lists a calendar more than once', async () => {
    await run({ calendars: [unreadable(ALICE, 'reachable'), unreadable(ALICE, 'reachable')] });
    expect(items()).toHaveLength(1);
  });

  it('shows nothing extra without canary results, for readable pending replies, or for a confirmed receipt', async () => {
    await run({ calendars: [unreadable(ALICE)] });
    expect(root.querySelector('.upgrade-liveness')).toBeNull();
    vi.clearAllMocks();
    view = mountVerify(root as never);
    await run({ calendars: [{ url: ALICE, ok: true, error: 'Not yet confirmed.' }] });
    expect(root.querySelector('.upgrade-liveness')).toBeNull();
    vi.clearAllMocks();
    view = mountVerify(root as never);
    await run({ status: 'bitcoin-confirmed', calendars: [unreadable(BOB, 'reachable')] }, t('upgrade.alreadyConfirmed'));
    expect(root.querySelector('.upgrade-liveness')).toBeNull();
  });

  it('relabels into Spanish from the retained result without repeating network work', async () => {
    await run({ calendars: [unreadable(ALICE, 'reachable'), unreadable(BOB, 'unreachable')] });
    setLang('es');
    view.relabel();
    expect(items()).toEqual([
      t('upgrade.liveness.reachable', { host: 'alice.btc.calendar.opentimestamps.org' }),
      t('upgrade.liveness.unreachable', { host: 'bob.btc.calendar.opentimestamps.org' }),
    ]);
    expect(root.querySelector('.upgrade-liveness')!.textContent).toContain(t('upgrade.liveness.intro'));
    expect(upgrade).toHaveBeenCalledTimes(1);
  });
});
