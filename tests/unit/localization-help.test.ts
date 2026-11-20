import { afterEach, describe, expect, it } from 'vitest';
import { getLang, setLang, t } from '../../src/ui/strings';
import { mountSettings } from '../../src/ui/views/settings';
import { doc, installFakeDom } from './ui-fake-dom';

const helpKeys = ['settings.help.calendars', 'settings.help.minimum', 'settings.help.explorers'] as const;
const previous = getLang();
afterEach(() => setLang(previous));

describe('visible network settings help', () => {
  it.each(['en', 'es'] as const)('renders all catalog explanations in %s', (lang) => {
    const restore = installFakeDom();
    try {
      setLang(lang);
      const root = doc.createElement('main');
      mountSettings(root as never, () => {});
      const explanations = root.all().filter((node) => node.classList.contains('settings-help'));
      expect(explanations.map((node) => node.textContent)).toEqual(helpKeys.map((key) => t(key)));
    } finally {
      restore();
    }
  });
});
