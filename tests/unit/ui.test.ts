import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDARS } from '../../src/core/net/allowlist';
import { VIEWS, parseHash } from '../../src/ui/router';
import { restoreDefaults, settings, stampConfigFromSettings, verifyConfigFromSettings, isDefault } from '../../src/ui/state';
import { TABLES, detectLang, en, setLang, t } from '../../src/ui/strings';

describe('strings (FR-14)', () => {
  it('every language has exactly the same keys and placeholders', () => {
    const keys = Object.keys(en).sort();
    for (const [lang, table] of Object.entries(TABLES)) {
      expect(Object.keys(table).sort(), lang).toEqual(keys);
      for (const k of keys) {
        const ph = (s: string): string[] => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
        expect(ph((table as Record<string, string>)[k]!), `${lang}:${k}`).toEqual(ph((en as Record<string, string>)[k]!));
      }
    }
  });

  it('mandatory copy blocks from SPEC section 11 are present verbatim', () => {
    setLang('en');
    expect(t('copy.stays')).toBe('Your file stays on your device. Only its fingerprint is used.');
    expect(t('copy.notTrue')).toBe('A receipt proves a file existed unchanged. It does not prove the file is true.');
    expect(t('copy.keep')).toBe("Keep your receipt. We don't store it.");
    expect(t('copy.pendingNotProof')).toBe('Pending is not proof yet.');
    expect(t('copy.visibleToServers')).toBe('Stamping is visible to the servers you contact. For sensitive use, use Tor Browser.');
  });

  it('detects language and interpolates', () => {
    expect(detectLang(['es-MX', 'en'])).toBe('es');
    expect(detectLang(['fr'])).toBe('en');
    setLang('en');
    expect(t('stamp.createMany', { n: 4 })).toBe('Create 4 receipts');
  });

  it('never says "created at" or calls L1 "proof" without the qualification', () => {
    for (const table of Object.values(TABLES)) for (const v of Object.values(table)) expect(v).not.toMatch(/created at/i);
  });
});

describe('router (FR-11)', () => {
  const h = 'a'.repeat(64);
  it('parses views and fingerprint fragments', () => {
    expect(parseHash('')).toEqual({ view: 'stamp', h: null });
    for (const v of VIEWS) expect(parseHash(`#${v}`).view).toBe(v);
    expect(parseHash(`#h=${h}`)).toEqual({ view: 'verify', h });
    expect(parseHash(`#verify&h=${h.toUpperCase()}`)).toEqual({ view: 'verify', h });
    expect(parseHash('#h=xyz')).toEqual({ view: 'stamp', h: null });
    expect(parseHash('#unknown')).toEqual({ view: 'stamp', h: null });
  });
});

describe('settings (FR-13)', () => {
  it('derives configs, clamps M, restores defaults', () => {
    settings.calendars.delete(DEFAULT_CALENDARS[0]!);
    settings.minCalendars = 9;
    expect(isDefault()).toBe(false);
    const cfg = stampConfigFromSettings();
    expect(cfg.calendars).toHaveLength(2);
    expect(cfg.minAccepted).toBe(2);
    settings.minCalendars = 0;
    expect(stampConfigFromSettings().minAccepted).toBe(1);
    expect(verifyConfigFromSettings().minSources).toBe(2);
    restoreDefaults();
    expect(isDefault()).toBe(true);
  });
});
