// The ONLY list of hosts the app may contact (SPEC section 9).
// MUST stay in sync with connect-src in the CSP; scripts/build.mjs generates the CSP from this file.

export interface Endpoint {
  readonly host: string;
  readonly role: 'calendar' | 'explorer';
}

export const ENDPOINTS: readonly Endpoint[] = [
  { host: 'alice.btc.calendar.opentimestamps.org', role: 'calendar' },
  { host: 'bob.btc.calendar.opentimestamps.org', role: 'calendar' },
  { host: 'finney.calendar.eternitywall.com', role: 'calendar' },
  { host: 'mempool.space', role: 'explorer' },
  { host: 'blockstream.info', role: 'explorer' },
];

export const ALLOWED_HOSTS: ReadonlySet<string> = new Set(ENDPOINTS.map((e) => e.host));

export const DEFAULT_CALENDARS: readonly string[] = ENDPOINTS.filter((e) => e.role === 'calendar').map((e) => `https://${e.host}`);
export const DEFAULT_EXPLORERS: readonly string[] = ENDPOINTS.filter((e) => e.role === 'explorer').map((e) => `https://${e.host}`);

export const DEFAULT_MIN_CALENDARS = 2;
export const DEFAULT_MIN_EXPLORERS = 2;
