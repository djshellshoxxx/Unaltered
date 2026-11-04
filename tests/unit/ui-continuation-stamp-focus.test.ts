import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashBlob } from '../../src/core/hash/hasher';
import { UnalteredError } from '../../src/core/errors';
import { mountStamp } from '../../src/ui/views/stamp';
import { t } from '../../src/ui/strings';
import { doc, type FElement, installFakeDom } from './ui-fake-dom';

vi.mock('../../src/core/hash/hasher', () => ({ hashBlob: vi.fn() }));

let restore: () => void;
let root: FElement;
beforeEach(() => {
  restore = installFakeDom();
  root = doc.createElement('section');
  doc.body.appendChild(root);
  vi.mocked(hashBlob).mockResolvedValue({ digest: new Uint8Array(32), hex: '0'.repeat(64), bytes: 3 });
  mountStamp(root as never);
});
afterEach(() => { restore(); vi.clearAllMocks(); });

async function add(): Promise<FElement> {
  const picker = root.querySelector('#stamp-file')!;
  picker.files = [new File(['abc'], 'sample.txt')];
  picker.dispatch('change');
  const card = root.querySelector('.item')!;
  // The minimal DOM implements Node.removeChild but not Element.remove. Match the native operation here.
  Object.assign(card, { remove() { card.parentNode?.removeChild(card); } });
  await vi.waitFor(() => expect(card.querySelector('.digest')).not.toBeNull());
  return card;
}
const removeOf = (card: FElement): FElement => card.all().find((node) => node.tagName === 'BUTTON' && node.textContent === t('common.remove'))!;

describe('Stamp removal keyboard focus', () => {
  it('returns focus to the file picker when the focused item is removed', async () => {
    const card = await add();
    const remove = removeOf(card);
    remove.focus();
    remove.dispatch('click');
    expect(root.querySelector('.item')).toBeNull();
    expect(doc.activeElement).toBe(root.querySelector('#stamp-file'));
    expect(doc.activeElement?.isConnected).toBe(true);
  });
  it('does not steal focus from a control outside the removed item', async () => {
    const card = await add();
    const picker = root.querySelector('#stamp-file')!;
    picker.focus();
    removeOf(card).dispatch('click');
    expect(doc.activeElement).toBe(picker);
  });
  it('returns focus to the picker when cancellation removes the focused hash control', async () => {
    vi.mocked(hashBlob).mockImplementationOnce((_blob, opts = {}) => new Promise((_resolve, reject) => {
      opts.signal?.addEventListener('abort', () => reject(new UnalteredError('ABORTED', 'Cancelled.')), { once: true });
    }));
    const picker = root.querySelector('#stamp-file')!;
    picker.files = [new File(['abc'], 'sample.txt')];
    picker.dispatch('change');
    const card = root.querySelector('.item')!;
    await vi.waitFor(() => expect(hashBlob).toHaveBeenCalledOnce());
    const cancel = card.all().find((node) => node.tagName === 'BUTTON' && node.textContent === t('common.cancel'))!;
    cancel.focus();
    cancel.dispatch('click');
    await vi.waitFor(() => expect(card.querySelector('.error')?.textContent).toBe(t('stamp.cancelled')));
    expect(doc.activeElement).toBe(picker);
  });
});
