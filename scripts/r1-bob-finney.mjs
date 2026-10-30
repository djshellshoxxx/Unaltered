// One-run live check of the Bob and Finney confirmed-upgrade paths in the browser (R1 residual). Opt-in: no CI job runs it.
// Usage (after `npm run build`):
//   node scripts/r1-bob-finney.mjs <file> <receipt.ots> [output-dir]          one app run against the live calendars
//   node scripts/r1-bob-finney.mjs --from-json <saved.json> <receipt.ots>     offline: classify a saved r1-acceptance run
// The receipt must already carry Bob and/or Finney pending attestations old enough to be anchored. This script makes
// no calendar submission and never retries; it runs scripts/r1-acceptance.mjs once and reports per calendar.
// Record the output in docs/R1_BOB_FINNEY_TEMPLATE.md. Prints hosts and statuses only, never file names or digests.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { calendarsInReceipt, classifyCalendars, markdownRows, overall } from './lib/r1-calendars.mjs';

const args = process.argv.slice(2);
const offline = args[0] === '--from-json';
const [first, receipt, outDir = '/tmp/unaltered-r1-bob-finney'] = offline ? args.slice(1) : args;
if (!first || !receipt) {
  console.error('usage: node scripts/r1-bob-finney.mjs <file> <receipt.ots> [output-dir]');
  console.error('       node scripts/r1-bob-finney.mjs --from-json <saved.json> <receipt.ots>');
  process.exit(2);
}

const named = calendarsInReceipt(await readFile(receipt));
if (named.length === 0) {
  console.error('The receipt names neither Bob nor Finney, so it cannot test their confirmed path. Nothing was sent.');
  process.exit(2);
}

let report;
if (offline) {
  report = JSON.parse(await readFile(first, 'utf8'));
} else {
  const run = spawnSync(process.execPath, ['scripts/r1-acceptance.mjs', first, receipt, outDir], { encoding: 'utf8' });
  if (run.stderr) process.stderr.write(run.stderr);
  try {
    report = JSON.parse(run.stdout);
  } catch {
    console.error(`r1-acceptance.mjs printed no JSON report (exit ${run.status}).`);
    process.exit(2);
  }
}

const rows = classifyCalendars(report, named);
const result = overall(report, rows);
console.log(JSON.stringify({
  checkedAt: report.checkedAt ?? null, browser: report.browser ?? null, mode: offline ? 'from-json' : 'live',
  appClassification: report.classification ?? null, verifyState: report.verify?.state ?? null,
  calendars: rows, result,
  note: 'Browser evidence only. A PASS also needs the reference check (docs/R1_ACCEPTANCE.md step 2) on the same receipt.',
}, null, 2));
console.log('\n| Calendar | Host | Upgrade requests | HTTP status | ACAO | Browser failure | Result |');
console.log('|---|---|---|---|---|---|---|');
console.log(markdownRows(rows));
process.exitCode = result === 'PASS' ? 0 : 1;
