# R1 acceptance procedure: confirmed upgrade in a browser plus independent verification

Current source evidence (2026-10-30): PR34 source d09c240 has native Alice app/reference PASS on one downloaded receipt;
see NETWORK.md and CONSOLIDATION_20261030.md for exact checkout/tree/job evidence. Bob/Finney and pending-response residuals
remain open. A newer documentation head must have its own CI evidence. Local executor attempts remain TLS/proxy-blocked.

R1 asks whether the app, running in a real browser under its own CSP, can upgrade a pending receipt to a Bitcoin-confirmed
one and verify it, and whether an independent implementation agrees. Pending `404` replies are already known to lack
`Access-Control-Allow-Origin` ([NETWORK.md](NETWORK.md)); the app keeps such receipts pending and reports the calendar failure.
The open question was the confirmed `200` reply.

This procedure makes **no new calendar submission**. It uses an already-anchored, *incomplete* receipt, so the only calendar
request is the app's own `GET /timestamp/<commitment>` for a commitment that has existed since 2016.

## Inputs (not committed; upstream licence LGPL-3.0)

From `opentimestamps/opentimestamps-client`, `examples/`:

| File | SHA-256 |
|---|---|
| `incomplete.txt` | `05c4f616a8e5310d19d938cfd769864d7f4ccdc2ca8b479b10af83564b097af9` |
| `incomplete.txt.ots` | `95673f2878cbcfdddded530bd2ad5f3fb04e13d2e659760d7c1386346fdd036c` |

```sh
mkdir -p /tmp/r1 && cd /tmp/r1
base=https://raw.githubusercontent.com/opentimestamps/opentimestamps-client/master/examples
curl -sO $base/incomplete.txt && curl -sO $base/incomplete.txt.ots
sha256sum incomplete.txt incomplete.txt.ots   # must match the table
```

## Step 1: the app, in a browser

```sh
npm ci --ignore-scripts && npm run build
node scripts/r1-acceptance.mjs /tmp/r1/incomplete.txt /tmp/r1/incomplete.txt.ots /tmp/r1/out
```

The script serves `dist/web` on a loopback port, opens it in Playwright's pinned Chromium (set `CHROMIUM_PATH` to use
another build), uses the Upgrade control, downloads the upgraded receipt the app offers, then verifies the file against it
with the Verify control. It records every external request's status, `access-control-allow-origin` and browser failure text.
It prints JSON with one `classification`:

| Classification | Meaning | Says nothing about |
|---|---|---|
| `PASS` | Upgrade produced a confirmed receipt and Verify showed **Verified**; no CSP violation | the independent check (step 2) |
| `TLS_OR_PROXY` | the browser failed before any HTTP reply (`ERR_CERT_*`, `ERR_SSL_*`, `ERR_TUNNEL_*`, `ERR_PROXY_*`) | CORS or the receipt: run on a host with a direct, uninspected path |
| `CORS_OR_TRANSPORT` | an upgrade request failed in the browser (`requestfailed`, e.g. `net::ERR_FAILED`) or its reply had no ACAO | the receipt: a blocked read cannot be judged |
| `RECEIPT_OR_PROOF` | the app rejected the receipt, or Verify showed *not valid* / *no match* with all reads succeeding | browser networking |
| `NOT_YET_CONFIRMED` | calendar answered `404`/pending with no browser failure | anything: try later or use an older receipt |
| `EXPLORERS` | Verify could not reach two agreeing explorers | the calendar path |
| `CSP_VIOLATION` | the page reported a CSP violation | must be fixed before any other conclusion |

## Step 2: the reference implementation, independently

Use the receipt the app downloaded, and a block header from a source you choose **other than** the app's explorers
(best: your own node). The reference library (`opentimestamps==0.4.5`, the same pin as the differential CI job) checks the
file digest and verifies the Bitcoin attestation against that header itself.

```sh
python3 -m venv /tmp/otsvenv && /tmp/otsvenv/bin/pip install opentimestamps==0.4.5
# Own node: bitcoin-cli getblockheader <hash> false
# Or, as a third-party source: the first 160 hex characters of https://blockchain.info/rawblock/<hash>?format=hex
/tmp/otsvenv/bin/python tests/differential/verify_reference.py /tmp/r1/incomplete.txt /tmp/r1/out/<downloaded>.ots <header-hex>
```

Expected: `"ok": true`, `"digestMatches": true`, and a `verifiedTime` equal to the block time the app showed.
A pending-only receipt or a wrong header must give `"ok": false` (exit 1).

## What closes R1

Both steps pass on the same downloaded receipt, in a browser on a host that can reach the calendars, with the outputs
recorded in [NETWORK.md](NETWORK.md). Native CI evidence is preferred, since this executor's network has varied between runs.
Bob and Finney still need their own confirmed `200` observation before they can be called browser-compatible for upgrades;
this example's receipt names only Alice. Do not work around a failure with `no-cors`, a relay, or relaxed CSP (SPEC section 9).
