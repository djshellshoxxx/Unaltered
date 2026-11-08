import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashBlob } from '../../src/core/hash/hasher';
import { stampBatch } from '../../src/core/ots/calendar';
import { serializeProof } from '../../src/core/ots/codec';
import { verify } from '../../src/core/ots/verify';
import { announce, setLiveRegion } from '../../src/ui/dom';
import { revokeAll } from '../../src/ui/download';
import { mountStamp } from '../../src/ui/views/stamp';
import { mountVerify } from '../../src/ui/views/verify';
import { setLang, t } from '../../src/ui/strings';
import { doc, type FElement, installFakeDom } from './ui-fake-dom';

vi.mock('../../src/core/hash/hasher', () => ({ hashBlob: vi.fn() }));
vi.mock('../../src/core/ots/calendar', async (original) => ({ ...await original<typeof import('../../src/core/ots/calendar')>(), stampBatch: vi.fn() }));
vi.mock('../../src/core/ots/verify', async (original) => ({ ...await original<typeof import('../../src/core/ots/verify')>(), verify: vi.fn() }));

let restore: () => void;
let root: FElement;
let live: FElement;
const digest = new Uint8Array(32);
const proof = serializeProof({ digest, root: { msg: digest, children: [], attestations: [{ kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' }] } });
beforeEach(() => {
  setLang('en');
  restore = installFakeDom();
  root = doc.createElement('section');
  live = doc.createElement('div');
  doc.body.appendChild(root);
  doc.body.appendChild(live);
  setLiveRegion(live as never);
  vi.mocked(hashBlob).mockResolvedValue({ digest, hex: '0'.repeat(64), bytes: 3 });
});
afterEach(() => {
  setLiveRegion(null as never); revokeAll(); restore(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks();
});
const button = (key: Parameters<typeof t>[0]): FElement => root.all().find((node) => node.tagName === 'BUTTON' && node.textContent === t(key))!;
async function addFile(): Promise<void> {
  mountStamp(root as never);
  const picker = root.querySelector('#stamp-file')!;
  picker.files = [new File(['abc'], 'sample.txt')];
  picker.dispatch('change');
  await vi.waitFor(() => expect(root.querySelector('.digest')).not.toBeNull());
}

describe('asynchronous view actions do not announce across views', () => {
  it('does not replace the current view announcement when clipboard completion arrives after navigation', async () => {
    let complete!: () => void;
    vi.stubGlobal('navigator', { clipboard: { writeText: () => new Promise<void>((resolve) => { complete = resolve; }) } });
    await addFile();
    vi.useFakeTimers();
    button('common.copy').dispatch('click');
    Object.assign(root, { hidden: true });
    live.textContent = 'Current view status';
    complete();
    await vi.runAllTimersAsync();
    expect(live.textContent).toBe('Current view status');
  });

  it('retains a completed receipt without announcing it over a different visible view', async () => {
    let complete!: (result: Awaited<ReturnType<typeof stampBatch>>) => void;
    vi.mocked(stampBatch).mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    await addFile();
    const acknowledgement = root.querySelector('.item')!.all().find((node) => node.tagName === 'INPUT' && node.getAttribute('type') === 'checkbox')!;
    acknowledgement.checked = true;
    acknowledgement.dispatch('change');
    button('stamp.create').dispatch('click');
    Object.assign(root, { hidden: true });
    live.textContent = 'Current view status';
    vi.useFakeTimers();
    complete({ proofs: [proof], calendars: [] });
    await vi.runAllTimersAsync();
    expect(root.querySelector('.stamp-result')?.textContent).toContain(t('stamp.pendingTitle'));
    expect(live.textContent).toBe('Current view status');
  });

  it('drops a queued announcement if its owning view becomes hidden before the timer runs', async () => {
    vi.useFakeTimers();
    announce('Old view status', root as never);
    Object.assign(root, { hidden: true });
    await vi.runAllTimersAsync();
    expect(live.textContent).toBe('');
  });

  it('drops a queued announcement if its owning view is removed', async () => {
    vi.useFakeTimers();
    announce('Old view status', root as never);
    doc.body.removeChild(root);
    await vi.runAllTimersAsync();
    expect(live.textContent).toBe('');
  });

  for (const hidden of [true, false]) {
    it(`retains a verification result and ${hidden ? 'keeps the current view status' : 'announces it while visible'}`, async () => {
      let complete!: (report: Awaited<ReturnType<typeof verify>>) => void;
      vi.mocked(verify).mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
      const view = mountVerify(root as never);
      view.setPrefill('0'.repeat(64));
      const picker = root.querySelector('#verify-receipt')!;
      picker.files = [new File([proof as BlobPart], 'sample.ots')];
      picker.dispatch('change');
      button('verify.check').dispatch('click');
      await vi.waitFor(() => expect(verify).toHaveBeenCalledOnce());
      Object.assign(root, { hidden });
      live.textContent = 'Current view status';
      vi.useFakeTimers();
      complete({ state: 'PENDING', detail: 'Awaiting Bitcoin confirmation.' });
      await vi.runAllTimersAsync();
      expect(root.querySelector('.verify-result')?.textContent).toContain(t('verify.state.PENDING'));
      expect(live.textContent).toBe(hidden ? 'Current view status' : t('verify.state.PENDING'));
    });
  }
});
