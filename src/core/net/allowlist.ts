// STUB: implemented by the OTS/network workstream (SPEC 9). The ONLY list of permitted hosts.
export const ALLOWED_HOSTS: readonly string[] = [
  'alice.btc.calendar.opentimestamps.org',
  'bob.btc.calendar.opentimestamps.org',
  'finney.calendar.eternitywall.com',
  'btc.calendar.catallaxy.com',
  'mempool.space',
  'blockstream.info',
];

export function isAllowedUrl(_url: string): boolean {
  throw new Error('not implemented');
}
