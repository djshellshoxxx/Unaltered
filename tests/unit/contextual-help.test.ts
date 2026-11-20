import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CALENDARS, DEFAULT_EXPLORERS } from '../../src/core/net/allowlist';
import { dropZone } from '../../src/ui/dom';
import { getLang, setLang } from '../../src/ui/strings';
import { mountSettings } from '../../src/ui/views/settings';
import { mountStamp } from '../../src/ui/views/stamp';
import { mountVerify } from '../../src/ui/views/verify';
import { doc, type FElement, installFakeDom } from './ui-fake-dom';

let restore: () => void;
const previous = getLang();
beforeEach(() => { restore = installFakeDom(); });
afterEach(() => { setLang(previous); restore(); });

function description(root: FElement, id: string): string {
  const input = root.querySelector(`#${id}`)!;
  expect(input, id).toBeTruthy();
  const ids = (input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  expect(ids.length, `${id} has an accessible description`).toBeGreaterThan(0);
  return ids.map((target) => {
    const matches = root.all().filter((node) => node.getAttribute('id') === target);
    expect(matches, `${id} references a unique visible description`).toHaveLength(1);
    expect(matches[0]!.getAttribute('hidden')).toBeNull();
    expect(matches[0]!.textContent.length).toBeGreaterThan(0);
    return matches[0]!.textContent;
  }).join(' ');
}

describe('contextual help for file and network choices', () => {
  it.each(['en', 'es'] as const)('describes every file picker in %s and updates retained views', (lang) => {
    setLang(lang);
    const stamp = doc.createElement('section');
    const verify = doc.createElement('section');
    const stampView = mountStamp(stamp as never);
    const verifyView = mountVerify(verify as never);
    const stampBefore = description(stamp, 'stamp-file');
    const ids = ['verify-file', 'verify-receipt', 'upgrade-receipt', 'batch-files', 'batch-receipts'];
    const before = ids.map((id) => description(verify, id));
    expect(before[0]).toMatch(lang === 'en' ? /exact.*file|file.*exact/ : /archivo.*exact/);
    expect(before[1]).toMatch(/\.ots/);
    expect(before[4]).toMatch(lang === 'en' ? /filename.*\.ots/ : /nombre.*\.ots/);
    setLang(lang === 'en' ? 'es' : 'en');
    stampView.relabel();
    verifyView.relabel();
    expect(description(stamp, 'stamp-file')).not.toBe(stampBefore);
    ids.forEach((id, index) => expect(description(verify, id)).not.toBe(before[index]));
  });

  it.each(['en', 'es'] as const)('connects all network controls to their %s explanations', (lang) => {
    setLang(lang);
    const root = doc.createElement('main');
    mountSettings(root as never, () => {});
    for (const url of [...DEFAULT_CALENDARS, ...DEFAULT_EXPLORERS]) {
      expect(description(root, `network-${new URL(url).host}`)).toMatch(lang === 'en' ? /operator|explorers/ : /operador|exploradores/);
    }
    expect(description(root, 'min-cal')).toMatch(lang === 'en' ? /minimum/i : /mínimo/i);
  });

  it('does not create a dangling description when a picker has no hint', () => {
    const zone = dropZone({ id: 'bare', label: 'Choose a file', hint: '', onFiles: () => {} }) as unknown as FElement;
    expect(zone.querySelector('#bare')!.getAttribute('aria-describedby')).toBeNull();
  });
});
