# R1 residual: Bob and Finney confirmed upgrade — one-run check and result template

Status (2026-10-30): **not run.** The script and this template are ready. Running them sends the app's own upgrade
requests to live calendars, so it waits for the owner to ask. No CI job runs it.

The Alice confirmed path passed in a real browser with an independent reference check ([NETWORK.md](NETWORK.md),
[R1_ACCEPTANCE.md](R1_ACCEPTANCE.md)). The upstream example receipt names only Alice, so Bob
(`bob.btc.calendar.opentimestamps.org`) and Finney (`finney.calendar.eternitywall.com`) have never been observed
returning a confirmed `200` to the browser. Until they are, they are not called browser-compatible for upgrades.

## What it needs

- A receipt that already carries a Bob and/or Finney **pending** attestation, old enough that the calendar has
  anchored it (normally a few hours; a day is safer), and the file it was made for.
  - The app's Stamp action submits to all three calendars, so a receipt the app made for a throwaway file works.
  - Making that receipt is itself a live submission. It is the owner's call, done once, before this check.
  - Use a throwaway file. Do not use a private file: the calendars see the request timing and your IP address.
- A host whose path to the calendars is direct and uninspected (TLS interception gives `TLS_OR_PROXY`, which says
  nothing about CORS). Native CI runners or an ordinary home connection are suitable.

## Run once

```sh
npm ci --ignore-scripts && npm run build
node scripts/r1-bob-finney.mjs <throwaway-file> <receipt.ots> /tmp/r1-bf/out > /tmp/r1-bf/result.txt; echo "exit $?"
```

The script refuses (exit 2, nothing sent) a receipt that names neither calendar. Otherwise it runs
`scripts/r1-acceptance.mjs` **once** (Upgrade, then Verify, in Chromium under the app's own CSP, no mocks, no CORS bypass,
no new submission) and prints JSON plus a Markdown table. It never retries. Exit 0 means `PASS`.

To re-classify a saved `r1-acceptance.mjs` report without any network access:

```sh
node scripts/r1-bob-finney.mjs --from-json <saved.json> <receipt.ots>
```

Then run [R1_ACCEPTANCE.md](R1_ACCEPTANCE.md) step 2 (reference implementation, header from a third source) on the
upgraded receipt the app downloaded to the output directory.

## Per-calendar results

| Result | Meaning |
|---|---|
| `CONFIRMED_READABLE` | `200` with `Access-Control-Allow-Origin`, no browser failure: the browser can read the confirmed reply |
| `CONFIRMED_BLOCKED` | `200` without ACAO: the confirmed reply exists but the browser cannot read it |
| `PENDING_READABLE` | `404` with ACAO: still pending, and pending replies are now readable (would change the D10 limitation) |
| `PENDING_BLOCKED` | `404` without ACAO: still pending; the known limitation. Try again later, once |
| `BLOCKED_OR_TRANSPORT` | browser failure with no HTTP status (often CORS): cannot tell pending from confirmed |
| `TLS_OR_PROXY` | failure before any reply: this host's network path, not the calendar |
| `NOT_REQUESTED` | the receipt names the calendar but the app sent it no upgrade request |

The overall `result` is `PASS` only when the app run passed (Verify showed **Verified**, no CSP violation) and every
named target calendar is `CONFIRMED_READABLE`.

## Result record (copy, fill in, add to NETWORK.md)

```
Date/time (UTC):
Run by:
Host and network path (no IP address):
Source commit (git rev-parse HEAD):
Browser (from the JSON "browser" field):
Receipt age (hours since stamping):
Calendars named in the receipt: bob / finney / both
Command and exit code:

| Calendar | Host | Upgrade requests | HTTP status | ACAO | Browser failure | Result |
|---|---|---|---|---|---|---|
| (paste the script's table rows) |

App classification:            Verify state:            Overall result:
Reference check (R1_ACCEPTANCE step 2): ok= ; digestMatches= ; verifiedTime= ; header source:
Agrees with the app's block time: yes / no
Conclusion: Bob confirmed path browser-compatible: yes / no / not established
            Finney confirmed path browser-compatible: yes / no / not established
Notes (anything unexpected; never file names or digests of private files):
```

Do not work around a failure with `no-cors`, a relay or a relaxed CSP (SPEC section 9, D10). Record failures as they are.
