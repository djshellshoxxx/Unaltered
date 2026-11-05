import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashBlob } from '../../src/core/hash/hasher';
import { detectBlob, stripMetadata } from '../../src/core/strip';
import { revokeAll } from '../../src/ui/download';
import { setLang, t } from '../../src/ui/strings';
import { mountStamp } from '../../src/ui/views/stamp';
import { doc, type FElement, installFakeDom } from './ui-fake-dom';

vi.mock('../../src/core/hash/hasher', () => ({ hashBlob: vi.fn() }));
vi.mock('../../src/core/strip', async (original) => ({
  ...await original<typeof import('../../src/core/strip')>(), detectBlob: vi.fn(), stripMetadata: vi.fn(),
}));

let restore: () => void;
let root: FElement;
beforeEach(() => {
  restore = installFakeDom();
  root = doc.createElement('section');
  doc.body.appendChild(root);
  vi.mocked(detectBlob).mockResolvedValue('png');
  vi.mocked(stripMetadata).mockResolvedValue({ kind: 'unsupported', reason: 'Animated PNG (APNG) is not cleaned.' });
  vi.mocked(hashBlob).mockResolvedValue({ digest: new Uint8Array(32), hex: '0'.repeat(64), bytes: 3 });
});
afterEach(() => { revokeAll(); restore(); setLang('en'); vi.clearAllMocks(); });

const createButton = (): FElement => root.all().find((node) => node.tagName === 'BUTTON' && node.textContent === t('stamp.create'))!;
const checkboxes = (): FElement[] => root.querySelector('.item')!.all().filter((node) => node.tagName === 'INPUT' && node.getAttribute('type') === 'checkbox');

describe('unsupported cleaning keeps the original-file warning distinct from user-disabled cleaning', () => {
  for (const lang of ['en', 'es'] as const) {
    it(`${lang}: warns accurately and requires acknowledgement before stamping the original`, async () => {
      setLang(lang);
      mountStamp(root as never);
      const original = new File(['abc'], 'animated.png', { type: 'image/png' });
      const picker = root.querySelector('#stamp-file')!;
      picker.files = [original];
      picker.dispatch('change');
      await vi.waitFor(() => expect(root.querySelector('.digest')).not.toBeNull());

      expect(checkboxes()[0]!.checked).toBe(true);
      expect(root.textContent).toContain(lang === 'en'
        ? 'We could not safely clean this file. It may contain hidden data. The receipt will apply to the original file.'
        : 'No pudimos limpiar este archivo de forma segura. Puede contener datos ocultos. El recibo se aplicará al archivo original.');
      expect(root.textContent).not.toContain(t('stamp.stripOffWarn'));
      expect(stripMetadata).toHaveBeenCalledExactlyOnceWith(original);
      expect(vi.mocked(hashBlob).mock.calls[0]![0]).toBe(original);
      expect(root.textContent).not.toContain(t('stamp.cleanedNotice'));
      expect(createButton().disabled).toBe(true);
      const acknowledge = checkboxes()[1]!;
      acknowledge.checked = true;
      acknowledge.dispatch('change');
      expect(createButton().disabled).toBe(false);

      const cleaning = checkboxes()[0]!;
      cleaning.checked = false;
      cleaning.dispatch('change');
      await vi.waitFor(() => expect(root.querySelector('.digest')).not.toBeNull());
      expect(root.textContent).toContain(t('stamp.stripOffWarn'));
      expect(checkboxes()[1]!.checked).toBe(false);
      expect(createButton().disabled).toBe(true);
      expect(stripMetadata).toHaveBeenCalledOnce();
      expect(vi.mocked(hashBlob).mock.calls[1]![0]).toBe(original);
    });
  }
});
