// Default endpoints and thresholds. Hosts here MUST also be in src/core/net/allowlist.ts
// and in the CSP connect-src (scripts/build.mjs generates CSP from the allowlist).

export interface StampConfig {
  /** Calendar base URLs, e.g. https://alice.btc.calendar.opentimestamps.org */
  calendars: string[];
  /** Minimum calendars that must accept (FR-4). Never below 1. */
  minAccepted: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface VerifyConfig {
  /** Esplora-compatible API base URLs, e.g. https://mempool.space/api */
  explorers: string[];
  /** Minimum independent sources that must agree (FR-7). Never below 2 for VERIFIED. */
  minAgreeing: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export const DEFAULT_CALENDARS: readonly string[] = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
  'https://btc.calendar.catallaxy.com',
];

export const DEFAULT_EXPLORERS: readonly string[] = [
  'https://mempool.space/api',
  'https://blockstream.info/api',
];

export const DEFAULT_MIN_ACCEPTED = 2;
export const DEFAULT_MIN_AGREEING = 2;
export const DEFAULT_TIMEOUT_MS = 15_000;

export function defaultStampConfig(): StampConfig {
  return { calendars: [...DEFAULT_CALENDARS], minAccepted: DEFAULT_MIN_ACCEPTED, timeoutMs: DEFAULT_TIMEOUT_MS };
}

export function defaultVerifyConfig(): VerifyConfig {
  return { explorers: [...DEFAULT_EXPLORERS], minAgreeing: DEFAULT_MIN_AGREEING, timeoutMs: DEFAULT_TIMEOUT_MS };
}
