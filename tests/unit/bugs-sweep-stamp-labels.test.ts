import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashBlob } from '../../src/core/hash/hasher';
import { stampBatch } from '../../src/core/ots/calendar';
import { serializeProof } from '../../src/core/ots/codec';
import { mountStamp, type StampView } from '../../src/ui/views/stamp';
import { addReceipt } from '../../src/ui/store';
import { revokeAll } from '../../src/ui/download';
import { setLang, t } from '../../src/ui/strings';
import { doc, type FElement, installFakeDom } from './ui-fake-dom';

vi.mock('../../src/core/hash/hasher', () => ({ hashBlob: vi.fn() }));
vi.mock('../../src/core/ots/calendar', async (original) => ({ ...await original<typeof import('../../src/core/ots/calendar')>(), stampBatch: vi.fn() }));
vi.mock('../../src/ui/store', () => ({ isEnabled: () => true, addReceipt: vi.fn() }));

let restore: () => void;
let root: FElement;
let view: StampView;
beforeEach(() => {
  setLang('en');
  restore = installFakeDom();
  root = doc.createElement('section');
  doc.body.appendChild(root);
  const digest = new Uint8Array(32);
  vi.mocked(hashBlob).mockResolvedValue({ digest, hex: '0'.repeat(64), bytes: 3 });
  vi.mocked(stampBatch).mockResolvedValue({ proofs: [serializeProof({ digest, root: { msg: digest, children: [],
    attestations: [{ kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' }] } })], calendars: [] });
  vi.mocked(addReceipt).mockReturnValue(true);
  view = mountStamp(root as never);
});
afterEach(() => { revokeAll(); restore(); setLang('en'); vi.clearAllMocks(); });

const button = (key: Parameters<typeof t>[0]): FElement => root.all().find((node) => node.tagName === 'BUTTON' && node.textContent === t(key))!;
const label = (): FElement => root.querySelector('#label-1')!;

async function stamp(): Promise<void> {
  const picker = root.querySelector('#stamp-file')!;
  picker.files = [new File(['abc'], 'sample.txt')];
  picker.dispatch('change');
  await vi.waitFor(() => expect(root.querySelector('.digest')).not.toBeNull());
  const acknowledgement = root.querySelector('.item')!.all().find((node) => node.tagName === 'INPUT' && node.getAttribute('type') === 'checkbox')!;
  acknowledgement.checked = true;
  acknowledgement.dispatch('change');
  expect(button('stamp.create').disabled).toBe(false);
  button('stamp.create').dispatch('click');
  await vi.waitFor(() => expect(label()).not.toBeNull());
}

describe('stamp receipt labels survive presentation-only language changes', () => {
  it('retains a typed unsaved label without saving it or submitting another timestamp', async () => {
    await stamp();
    label().value = 'Draft label á 記録';
    label().dispatch('input');
    setLang('es');
    view.relabel();
    expect(label().value).toBe('Draft label á 記録');
    expect(addReceipt).not.toHaveBeenCalled();
    expect(stampBatch).toHaveBeenCalledTimes(1);
  });

  for (const saved of [true, false]) {
    it(`preserves and translates a ${saved ? 'successful' : 'failed'} save result`, async () => {
      await stamp();
      vi.mocked(addReceipt).mockReturnValue(saved);
      label().value = 'Typed label';
      label().dispatch('input');
      button('stamp.saveToList').dispatch('click');
      const key = saved ? 'stamp.savedToList' : 'stamp.saveFailed';
      expect(root.textContent).toContain(t(key));
      setLang('es');
      view.relabel();
      expect(label().value).toBe('Typed label');
      expect(root.textContent).toContain(t(key));
      expect(addReceipt).toHaveBeenCalledTimes(1);
    });
  }

  it('clears the saved notice when the user edits the draft, without saving automatically', async () => {
    await stamp();
    label().value = 'Saved label';
    label().dispatch('input');
    button('stamp.saveToList').dispatch('click');
    label().value = 'Unsaved edit';
    label().dispatch('input');
    setLang('es');
    view.relabel();
    expect(label().value).toBe('Unsaved edit');
    expect(root.textContent).not.toContain(t('stamp.savedToList'));
    expect(addReceipt).toHaveBeenCalledTimes(1);
  });
});
