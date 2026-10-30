// Pure helpers for scripts/r1-bob-finney.mjs: which calendars a receipt names, and what the browser saw for each.
// No network, no file names, no digests. Tested offline in tests/unit/r1-calendars.test.ts.

export const TARGETS = {
  bob: 'bob.btc.calendar.opentimestamps.org',
  finney: 'finney.calendar.eternitywall.com',
};

// A pending attestation stores its calendar URI as ASCII bytes, so a byte search finds the hosts a receipt names.
// This is only a precheck: the browser requests below are the evidence.
export function calendarsInReceipt(bytes) {
  const text = Buffer.from(bytes).toString('latin1');
  return Object.entries(TARGETS).filter(([, host]) => text.includes(`https://${host}`)).map(([name]) => name);
}

// One row per target calendar the receipt names, from the `requests` array that scripts/r1-acceptance.mjs prints.
// Order matters, as in r1-acceptance.mjs: a failure before any HTTP reply is about this host's path, not CORS.
export function classifyCalendars(report, named) {
  const requests = Array.isArray(report?.requests) ? report.requests : [];
  return named.map((name) => {
    const host = TARGETS[name];
    const seen = requests.filter((r) => r.kind === 'upgrade' && r.host === host);
    const last = seen.at(-1) ?? null;
    const row = {
      calendar: name, host, requests: seen.length,
      status: last?.status ?? null, acao: last?.acao ?? null, failure: last?.failure ?? null,
    };
    row.result = !last ? 'NOT_REQUESTED'
      : /ERR_(CERT|SSL|TUNNEL|PROXY)/.test(row.failure ?? '') ? 'TLS_OR_PROXY'
      : row.status === 200 && row.acao && !row.failure ? 'CONFIRMED_READABLE'
      : row.status === 404 && row.acao && !row.failure ? 'PENDING_READABLE'
      : row.status === 404 ? 'PENDING_BLOCKED'
      : row.status === 200 ? 'CONFIRMED_BLOCKED'
      : 'BLOCKED_OR_TRANSPORT';
    return row;
  });
}

// Bob/Finney count as browser-compatible for confirmed upgrades only if every named target gave a readable 200
// and the whole app run passed (Verify showed Verified, no CSP violation).
export function overall(report, rows) {
  return rows.length > 0 && report?.classification === 'PASS' && rows.every((r) => r.result === 'CONFIRMED_READABLE')
    ? 'PASS' : 'NOT_ESTABLISHED';
}

export function markdownRows(rows) {
  return rows.map((r) => `| ${r.calendar} | ${r.host} | ${r.requests} | ${r.status ?? '—'} | ${r.acao ?? 'missing'} | ${r.failure ?? '—'} | ${r.result} |`).join('\n');
}
