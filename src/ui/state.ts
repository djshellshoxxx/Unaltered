// In-memory settings (FR-13). Nothing here is persisted; a reload restores the defaults.
import { DEFAULT_CALENDARS, DEFAULT_EXPLORERS, DEFAULT_MIN_CALENDARS, DEFAULT_MIN_EXPLORERS } from '../core/net/allowlist';
import { defaultStampConfig, type StampConfig } from '../core/ots/calendar';
import { esploraSource } from '../core/ots/bitcoin';
import type { VerifyConfig } from '../core/ots/verify';

export interface Settings {
  calendars: Set<string>;
  explorers: Set<string>;
  minCalendars: number;
}

export const settings: Settings = {
  calendars: new Set(DEFAULT_CALENDARS),
  explorers: new Set(DEFAULT_EXPLORERS),
  minCalendars: DEFAULT_MIN_CALENDARS,
};

export function isDefault(): boolean {
  return (
    settings.minCalendars === DEFAULT_MIN_CALENDARS &&
    DEFAULT_CALENDARS.every((c) => settings.calendars.has(c)) &&
    settings.calendars.size === DEFAULT_CALENDARS.length &&
    DEFAULT_EXPLORERS.every((c) => settings.explorers.has(c)) &&
    settings.explorers.size === DEFAULT_EXPLORERS.length
  );
}

export function restoreDefaults(): void {
  settings.calendars = new Set(DEFAULT_CALENDARS);
  settings.explorers = new Set(DEFAULT_EXPLORERS);
  settings.minCalendars = DEFAULT_MIN_CALENDARS;
}

export function stampConfigFromSettings(signal?: AbortSignal): StampConfig {
  const base = defaultStampConfig();
  const calendars = [...settings.calendars];
  return { ...base, calendars, minAccepted: Math.max(1, Math.min(settings.minCalendars, calendars.length)), signal };
}

export function verifyConfigFromSettings(signal?: AbortSignal): VerifyConfig {
  return { sources: [...settings.explorers].map((u) => esploraSource(u)), minSources: DEFAULT_MIN_EXPLORERS, signal };
}
