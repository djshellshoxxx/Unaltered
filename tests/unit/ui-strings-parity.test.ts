import { describe, expect, it } from 'vitest';
import { TABLES, en, setLang, t, type StringKey } from '../../src/ui/strings';

const tokens = (s: string): string[] => (s.match(/\{[^{}]*\}/g) ?? []).sort();
const stray = (s: string): string => s.replace(/\{[A-Za-z]+\}/g, '');

const es = TABLES.es;

describe('EN/ES string tables (FR-14)', () => {
  const keys = Object.keys(en) as StringKey[];

  it('has no missing or extra keys in any language', () => {
    for (const [lang, table] of Object.entries(TABLES)) {
      const have = new Set(Object.keys(table));
      expect(keys.filter((k) => !have.has(k)), `${lang} missing`).toEqual([]);
      expect([...have].filter((k) => !(k in en)), `${lang} extra`).toEqual([]);
    }
  });

  it('uses only simple {name} placeholders, identical in every language', () => {
    for (const [lang, table] of Object.entries(TABLES)) {
      for (const k of keys) {
        const v = (table as Record<string, string>)[k]!;
        expect(stray(v), `${lang}:${k} has a malformed brace`).not.toMatch(/[{}]/);
        expect(tokens(v), `${lang}:${k}`).toEqual(tokens(en[k]));
      }
    }
  });

  it('has no empty values and no untranslated long Spanish strings', () => {
    for (const k of keys) {
      expect(en[k].trim().length, `en:${k}`).toBeGreaterThan(0);
      expect(es[k].trim().length, `es:${k}`).toBeGreaterThan(0);
      if (en[k].length > 40) expect(es[k], `es:${k} is identical to English`).not.toBe(en[k]);
    }
  });

  it('substitutes every placeholder and leaves none behind', () => {
    for (const lang of ['en', 'es'] as const) {
      setLang(lang);
      for (const k of keys) {
        const vars = Object.fromEntries(tokens(en[k]).map((x) => [x.slice(1, -1), 'V']));
        expect(t(k, vars), `${lang}:${k}`).not.toMatch(/[{}]/);
      }
    }
    setLang('en');
  });

  it('does not re-expand placeholders found inside substituted values', () => {
    setLang('en');
    // A calendar host or a core error message is untrusted text; it must not be treated as a template.
    expect(t('stamp.rejected', { reason: '{n}' })).toBe(en['stamp.rejected'].replace('{reason}', '{n}'));
    expect(t('upgrade.download', { name: '{name}' })).toBe(en['upgrade.download'].replace('{name}', '{name}'));
    // Two variables: the first value must not be re-substituted by the second key.
    expect(t('verify.d.noLater', { time: '{x}', x: 'EVIL' })).toContain('{x}');
  });
});
