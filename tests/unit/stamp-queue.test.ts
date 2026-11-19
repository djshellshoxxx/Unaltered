import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnalteredError } from '../../src/core/errors';
import { hashBlob, type HashResult } from '../../src/core/hash/hasher';
import { stampBatch } from '../../src/core/ots/calendar';
import { serializeProof } from '../../src/core/ots/codec';
import { revokeAll } from '../../src/ui/download';
import { setLang, t } from '../../src/ui/strings';
import { mountStamp, type StampView } from '../../src/ui/views/stamp';
import { doc, type FElement, installFakeDom } from './ui-fake-dom';

vi.mock('../../src/core/hash/hasher', () => ({ hashBlob: vi.fn() }));
vi.mock('../../src/core/ots/calendar', async (original) => ({ ...await original<typeof import('../../src/core/ots/calendar')>(), stampBatch: vi.fn() }));

let restore: () => void;
let root: FElement;
let view: StampView;
const result: HashResult = { digest: new Uint8Array(32), hex: '0'.repeat(64), bytes: 3 };
const proof = serializeProof({ digest: result.digest, root: { msg: result.digest, children: [], attestations: [
  { kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' },
] } });

const cards = (): FElement[] => root.all().filter((node) => node.classList.contains('item'));
const button = (owner: FElement, key: Parameters<typeof t>[0]): FElement => owner.all().find(
  (node) => node.tagName === 'BUTTON' && node.textContent === t(key),
)!;
function select(count: number, prefix = 'file'): void {
  const picker = root.querySelector('#stamp-file')!;
  picker.files = Array.from({ length: count }, (_, i) => new File(['abc'], `${prefix}-${i}.txt`));
  picker.dispatch('change');
  for (const card of cards()) Object.assign(card, { remove() { card.parentNode?.removeChild(card); } });
}

beforeEach(() => {
  vi.resetAllMocks();
  setLang('en');
  restore = installFakeDom();
  root = doc.createElement('section');
  doc.body.appendChild(root);
  view = mountStamp(root as never);
  vi.mocked(hashBlob).mockResolvedValue(result);
});
afterEach(async () => {
  for (const node of root.all()) Object.assign(node, { remove() { node.parentNode?.removeChild(node); } });
  for (const card of cards()) button(card, 'common.remove')?.dispatch('click');
  // Allow aborted operations and their queue cleanup to settle while their DOM still exists.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  revokeAll();
  restore();
  setLang('en');
});

function heldHashes(): { finished: (() => void)[]; names: string[]; maxActive: () => number } {
  let active = 0;
  let peak = 0;
  const finished: (() => void)[] = [];
  const names: string[] = [];
  vi.mocked(hashBlob).mockImplementation((blob, options = {}) => new Promise((resolve, reject) => {
    names.push((blob as File).name);
    active++;
    peak = Math.max(peak, active);
    let settled = false;
    const settle = (aborted: boolean): void => {
      if (settled) return;
      settled = true;
      active--;
      if (aborted) reject(new UnalteredError('ABORTED', 'Cancelled.'));
      else resolve(result);
    };
    options.signal?.addEventListener('abort', () => settle(true), { once: true });
    finished.push(() => settle(false));
  }));
  return { finished, names, maxActive: () => peak };
}

describe('bounded Stamp file processing', () => {
  it('processes at most two files concurrently and drains the waiting files in selection order', async () => {
    const held = heldHashes();
    select(5);
    await vi.waitFor(() => expect(hashBlob).toHaveBeenCalledTimes(2));
    expect(cards()).toHaveLength(5);
    expect(cards()[2]!.textContent).toContain('Waiting to process your file');
    for (let i = 0; i < 5; i++) {
      held.finished[i]!();
      await vi.waitFor(() => expect(hashBlob).toHaveBeenCalledTimes(Math.min(5, i + 3)));
    }
    await vi.waitFor(() => expect(cards().every((card) => card.querySelector('.digest'))).toBe(true));
    expect(held.maxActive()).toBe(2);
    expect(held.names).toEqual(['file-0.txt', 'file-1.txt', 'file-2.txt', 'file-3.txt', 'file-4.txt']);
  });

  it('cancels a waiting file without ever hashing it and retains that result across language changes', async () => {
    const held = heldHashes();
    select(4);
    await vi.waitFor(() => expect(hashBlob).toHaveBeenCalledTimes(2));
    const queued = cards()[2]!;
    button(queued, 'common.cancel').focus();
    button(queued, 'common.cancel').dispatch('click');
    expect(queued.querySelector('.error')?.textContent).toBe(t('stamp.cancelled'));
    expect(queued.querySelector('progress')).toBeNull();
    expect(doc.activeElement).toBe(root.querySelector('#stamp-file'));
    setLang('es');
    view.relabel();
    expect(hashBlob).toHaveBeenCalledTimes(2);
    held.finished[0]!();
    await vi.waitFor(() => expect(hashBlob).toHaveBeenCalledTimes(3));
    expect(held.names).toEqual(['file-0.txt', 'file-1.txt', 'file-3.txt']);
    held.finished[1]!();
    held.finished[2]!();
  });

  for (const index of [0, 2]) {
    it(`removes ${index === 0 ? 'an active' : 'a waiting'} file without leaking a slot or processing a removed file`, async () => {
      const held = heldHashes();
      select(4);
      await vi.waitFor(() => expect(hashBlob).toHaveBeenCalledTimes(2));
      button(cards()[index]!, 'common.remove').dispatch('click');
      expect(cards()).toHaveLength(3);
      if (index === 2) held.finished[0]!();
      await vi.waitFor(() => expect(hashBlob).toHaveBeenCalledTimes(3));
      expect(held.names[2]).toBe(index === 0 ? 'file-2.txt' : 'file-3.txt');
      expect(held.maxActive()).toBe(2);
      held.finished[1]!();
      held.finished[2]!();
      if (index === 0) {
        await vi.waitFor(() => expect(hashBlob).toHaveBeenCalledTimes(4));
        held.finished[3]!();
      }
    });
  }

  it('rejects an oversized selection before processing or retaining any files', async () => {
    select(51);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(cards()).toHaveLength(0);
    expect(hashBlob).not.toHaveBeenCalled();
    expect(root.textContent).toContain('50');
    expect(root.all().some((node) => node.getAttribute('role') === 'alert')).toBe(true);
  });

  it('accepts exactly 50 files but rejects an addition that would exceed the total without losing existing results', async () => {
    select(50);
    await vi.waitFor(() => expect(cards().filter((card) => card.querySelector('.digest'))).toHaveLength(50));
    select(1, 'extra');
    expect(cards()).toHaveLength(50);
    expect(hashBlob).toHaveBeenCalledTimes(50);
    button(cards()[0]!, 'common.remove').dispatch('click');
    select(1, 'replacement');
    await vi.waitFor(() => expect(hashBlob).toHaveBeenCalledTimes(51));
    expect(cards()).toHaveLength(50);
  });

  it('keeps an in-flight stamp batch stable, then allows the user to add the rejected selection again', async () => {
    let complete!: (value: Awaited<ReturnType<typeof stampBatch>>) => void;
    vi.mocked(stampBatch).mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    select(1);
    await vi.waitFor(() => expect(cards()[0]!.querySelector('.digest')).not.toBeNull());
    const acknowledge = cards()[0]!.all().find((node) => node.tagName === 'INPUT' && node.getAttribute('type') === 'checkbox')!;
    acknowledge.checked = true;
    acknowledge.dispatch('change');
    button(root, 'stamp.create').dispatch('click');
    expect(stampBatch).toHaveBeenCalledOnce();
    select(1, 'later');
    expect(cards()).toHaveLength(1);
    expect(hashBlob).toHaveBeenCalledOnce();
    complete({ proofs: [proof], calendars: [] });
    await vi.waitFor(() => expect(root.textContent).toContain(t('stamp.pendingTitle')));
    select(1, 'later');
    await vi.waitFor(() => expect(hashBlob).toHaveBeenCalledTimes(2));
    expect(cards()).toHaveLength(2);
    expect(cards()[0]!.all().some((node) => node.tagName === 'A' && node.getAttribute('download') === 'file-0.txt.ots')).toBe(true);
  });
});
