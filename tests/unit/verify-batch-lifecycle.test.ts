import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashBlob } from '../../src/core/hash/hasher';
import { verify, type VerifyReport } from '../../src/core/ots/verify';
import { mountVerify, type VerifyView } from '../../src/ui/views/verify';
import { setLang, t } from '../../src/ui/strings';
import { doc, type FElement, installFakeDom } from './ui-fake-dom';

vi.mock('../../src/core/hash/hasher', () => ({ hashBlob: vi.fn() }));
vi.mock('../../src/core/ots/verify', () => ({ verify: vi.fn() }));

let restore: () => void;
let root: FElement;
let view: VerifyView;
let receipt: File;
beforeEach(() => {
  setLang('en');
  restore = installFakeDom();
  root = doc.createElement('section');
  doc.body.appendChild(root);
  view = mountVerify(root as never);
  vi.mocked(hashBlob).mockResolvedValue({ digest: new Uint8Array(32), hex: '0'.repeat(64), bytes: 3 });
  vi.mocked(verify).mockResolvedValue({ state: 'PENDING', detail: 'pending' });
  receipt = new File(['proof'], 'note.txt.ots');
  select('batch-files', [new File(['abc'], 'note.txt')]);
  select('batch-receipts', [receipt]);
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); restore(); setLang('en'); });

function select(id: string, files: File[]): void {
  const picker = root.querySelector(`#${id}`)!;
  picker.files = files;
  picker.dispatch('change');
}
function button(label: string): FElement {
  const found = root.querySelector('.batch-verify')!.all().find((node) => node.tagName === 'BUTTON' && node.textContent === label);
  expect(found, label).toBeTruthy();
  return found!;
}
const output = (): string => root.querySelector('.batch-results')!.textContent;

describe('batch verification presentation ownership', () => {
  it('clears the working state when cancelled and ignores a late completed receipt', async () => {
    let finish!: (bytes: ArrayBuffer) => void;
    vi.spyOn(receipt, 'arrayBuffer').mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    button(t('batch.run')).dispatch('click');
    await vi.waitFor(() => expect(receipt.arrayBuffer).toHaveBeenCalledOnce());
    expect(output()).toBe(t('batch.working'));
    button(t('common.cancel')).dispatch('click');
    expect(output()).not.toContain(t('batch.working'));
    expect(output()).toMatch(/cancelled/i);
    expect(button(t('batch.run')).disabled).toBe(false);
    const cancelled = output();
    finish(new TextEncoder().encode('proof').buffer);
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(output()).toBe(cancelled);
    expect(verify).not.toHaveBeenCalled();
    setLang('es');
    view.relabel();
    expect(output()).toMatch(/cancelad/i);
    expect(output()).not.toBe(cancelled);
  });

  it('relabels a working batch without reading any file twice', async () => {
    vi.spyOn(receipt, 'arrayBuffer').mockReturnValue(new Promise(() => {}));
    button(t('batch.run')).dispatch('click');
    await vi.waitFor(() => expect(receipt.arrayBuffer).toHaveBeenCalledOnce());
    setLang('es');
    view.relabel();
    expect(output()).toBe(t('batch.working'));
    expect(hashBlob).toHaveBeenCalledOnce();
    expect(receipt.arrayBuffer).toHaveBeenCalledOnce();
    button(t('common.cancel')).dispatch('click');
  });

  it('relabels completed block labels without rerunning verification', async () => {
    const report: VerifyReport = { state: 'VERIFIED', detail: 'verified', bitcoin: {
      height: 42, blockHash: '1'.repeat(64), blockTimeUtc: '2020-01-01T00:00:00Z', sourcesAgreeing: ['one', 'two'],
    } };
    vi.mocked(verify).mockResolvedValue(report);
    button(t('batch.run')).dispatch('click');
    await vi.waitFor(() => expect(output()).toContain(t('batch.block', { height: 42 })));
    setLang('es');
    view.relabel();
    expect(output()).toContain(t('batch.block', { height: 42 }));
    expect(output()).toContain('VERIFIED');
    expect(output()).toContain('note.txt');
    expect(verify).toHaveBeenCalledOnce();
  });

  it('relabels pairing errors and clears them on a new selection', () => {
    select('batch-receipts', [new File(['proof'], 'other.txt.ots')]);
    button(t('batch.run')).dispatch('click');
    expect(output()).toBe(t('batch.pairError'));
    setLang('es');
    view.relabel();
    expect(output()).toBe(t('batch.pairError'));
    select('batch-receipts', [receipt]);
    expect(output()).toBe('');
  });
});
