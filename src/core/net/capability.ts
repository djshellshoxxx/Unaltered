/**
 * navigator.onLine is a browser connectivity hint, never a calendar/explorer
 * reachability check or a statement about Bitcoin confirmation.
 */
export function networkCapabilityText(online: boolean): string {
  return online
    ? 'Browser reports online. Stamping, receipt upgrades and Bitcoin verification require reachable external services; this is not a server health check. File hashing stays local.'
    : 'Browser reports offline. Hashing and local file inspection remain available; calendar stamping, receipt upgrades and live Bitcoin verification may be unavailable. Existing receipts are not automatically invalid.';
}
