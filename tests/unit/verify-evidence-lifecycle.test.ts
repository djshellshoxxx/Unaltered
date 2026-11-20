import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashBlob } from '../../src/core/hash/hasher';
import { createEvidenceZip } from '../../src/core/reports/evidence-zip';
import { verify } from '../../src/core/ots/verify';
import { mountVerify, type VerifyView } from '../../src/ui/views/verify';
import { setLang, t } from '../../src/ui/strings';
import { doc, FElement, installFakeDom } from './ui-fake-dom';

vi.mock('../../src/core/hash/hasher', () => ({ hashBlob: vi.fn() }));
vi.mock('../../src/core/reports/evidence-zip', () => ({ createEvidenceZip: vi.fn() }));
vi.mock('../../src/core/ots/verify', () => ({ verify: vi.fn() }));

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(reason: unknown): void } {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

let restore: () => void;
let root: FElement;
let view: VerifyView;
let click: ReturnType<typeof vi.fn>;
let original: File;
let receipt: File;

beforeEach(() => {
  setLang('en');
  restore = installFakeDom();
  vi.stubGlobal('window', { setTimeout: vi.fn() });
  click = vi.fn();
  vi.spyOn(doc, 'createElement').mockImplementation((tag) => {
    const node = new FElement(tag.toUpperCase());
    if (tag === 'a') Object.assign(node, { click });
    return node;
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:evidence');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.mocked(createEvidenceZip).mockResolvedValue(Uint8Array.of(0x50, 0x4b));
  vi.mocked(hashBlob).mockResolvedValue({ digest: new Uint8Array(32), hex: '0'.repeat(64), bytes: 3 });
  vi.mocked(verify).mockResolvedValue({ state: 'PENDING', detail: 'pending' });
  root = doc.createElement('section');
  doc.body.appendChild(root);
  view = mountVerify(root as never);
  original = new File(['abc'], 'note.txt');
  receipt = new File(['proof'], 'note.txt.ots');
  select('verify-file', original);
  select('verify-receipt', receipt);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  restore();
  setLang('en');
});

function select(id: string, file: File): void {
  const picker = root.querySelector(`#${id}`)!;
  picker.files = [file];
  picker.dispatch('change');
}
function button(label: string): FElement {
  const result = root.all().find((node) => node.tagName === 'BUTTON' && node.textContent === label);
  expect(result, label).toBeTruthy();
  return result!;
}
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

describe('evidence exports belong to the selected file and receipt', () => {
  it('explains the existing size limit before reading either selected file', () => {
    Object.defineProperty(original, 'size', { value: 16 * 1024 * 1024 });
    const originalRead = vi.spyOn(original, 'arrayBuffer');
    const receiptRead = vi.spyOn(receipt, 'arrayBuffer');
    button(t('evidence.downloadZip')).dispatch('click');
    expect(root.querySelector('.verify-result')!.textContent).toBe(t('evidence.limit'));
    expect(originalRead).not.toHaveBeenCalled();
    expect(receiptRead).not.toHaveBeenCalled();
    expect(button(t('verify.check')).disabled).toBe(false);
  });

  it('relabels the retained evidence-size explanation without reading the inputs', () => {
    Object.defineProperty(original, 'size', { value: 16 * 1024 * 1024 });
    const originalRead = vi.spyOn(original, 'arrayBuffer');
    const receiptRead = vi.spyOn(receipt, 'arrayBuffer');
    button(t('evidence.downloadZip')).dispatch('click');
    for (const language of ['es', 'en'] as const) {
      setLang(language);
      view.relabel();
      expect(root.querySelector('.verify-result')!.textContent).toBe(t('evidence.limit'));
      expect(button(t('verify.check')).disabled).toBe(false);
    }
    expect(originalRead).not.toHaveBeenCalled();
    expect(receiptRead).not.toHaveBeenCalled();
  });

  it('starts only one export while the input read is held', async () => {
    const held = deferred<ArrayBuffer>();
    const read = vi.spyOn(original, 'arrayBuffer').mockReturnValue(held.promise);
    const exportButton = button(t('evidence.downloadZip'));
    exportButton.dispatch('click');
    exportButton.dispatch('click');
    expect(read).toHaveBeenCalledOnce();
    expect(button(t('verify.check')).disabled).toBe(true);
    expect(button(t('common.cancel')).disabled).toBe(false);
    held.resolve(new TextEncoder().encode('abc').buffer);
    await settle();
    expect(createEvidenceZip).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });

  it.each(['verify-file', 'verify-receipt'])('ignores a stale read after replacing %s', async (id) => {
    const held = deferred<ArrayBuffer>();
    vi.spyOn(original, 'arrayBuffer').mockReturnValue(held.promise);
    button(t('evidence.downloadZip')).dispatch('click');
    select(id, new File(['replacement'], id === 'verify-file' ? 'new.txt' : 'new.txt.ots'));
    held.resolve(new TextEncoder().encode('abc').buffer);
    await settle();
    expect(createEvidenceZip).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('ignores a stale read error after selection changes', async () => {
    const held = deferred<ArrayBuffer>();
    vi.spyOn(original, 'arrayBuffer').mockReturnValue(held.promise);
    button(t('evidence.downloadZip')).dispatch('click');
    select('verify-file', new File(['replacement'], 'new.txt'));
    held.reject(new Error('old file became unreadable'));
    await settle();
    expect(root.querySelector('.verify-result')!.textContent).toBe('');
    expect(button(t('verify.check')).disabled).toBe(false);
  });

  it('discards an archive that finishes after cancellation and releases the actions immediately', async () => {
    const held = deferred<Uint8Array>();
    vi.mocked(createEvidenceZip).mockReturnValue(held.promise);
    button(t('evidence.downloadZip')).dispatch('click');
    await vi.waitFor(() => expect(createEvidenceZip).toHaveBeenCalledOnce());
    button(t('common.cancel')).dispatch('click');
    expect(button(t('verify.check')).disabled).toBe(false);
    held.resolve(Uint8Array.of(0x50, 0x4b));
    await settle();
    expect(click).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('does not lose ownership during a language switch or reread the files', async () => {
    const held = deferred<ArrayBuffer>();
    const read = vi.spyOn(original, 'arrayBuffer').mockReturnValue(held.promise);
    button(t('evidence.downloadZip')).dispatch('click');
    setLang('es');
    view.relabel();
    expect(button(t('verify.check')).disabled).toBe(true);
    expect(button(t('common.cancel')).disabled).toBe(false);
    expect(read).toHaveBeenCalledOnce();
    held.resolve(new TextEncoder().encode('abc').buffer);
    await settle();
    expect(click).toHaveBeenCalledOnce();
    expect(button(t('verify.check')).disabled).toBe(false);
  });
});
