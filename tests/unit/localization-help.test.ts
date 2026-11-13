import { describe, expect, it } from 'vitest';
import { en, es, detectLang, setLang, t } from '../../src/ui/strings';

describe('localized contextual help', () => {
  it('maintains exact English/Spanish key parity and placeholder parity', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const tokens = (value: string) => [...value.matchAll(/\{([A-Za-z]+)\}/g)].map((match) => match[1]).sort();
      expect(tokens(es[key])).toEqual(tokens(en[key]));
    }
  });
  it('renders network-context explanations in both languages', () => {
    expect(detectLang(['es-MX'])).toBe('es');
    setLang('es');
    expect(t('settings.help.calendars')).toContain('calendarios');
    setLang('en');
    expect(t('settings.help.calendars')).toContain('Calendar');
  });
});
