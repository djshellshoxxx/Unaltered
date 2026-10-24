# Network facts (M0-3)

Status: **Live server responses checked on 2026-10-22; browser pending-response CORS remains unresolved.** Calendar submission
and both explorer endpoints return the required CORS headers. Calendar pending `404` replies do not. These are Node observations
through the environment's supported HTTPS proxy, not a complete live browser round trip. **Risk R1 remains open.**

### Replacement executor check — 2026-10-24

The fresh saved environment could not reach any of the five service hosts. `node --use-env-proxy scripts/network-check.mjs`
exits 1 for all five; a direct Node request reports `EAI_AGAIN`, while a normal proxy CONNECT to the Alice calendar returns
HTTP 403. This is an execution-environment limitation, not new evidence about those services' CORS headers.

The new opt-in browser probe runs against the built site's real CSP, without request routing or browser-security bypass:

```sh
npm run build
CHROMIUM_PATH=/usr/bin/chromium XDG_CACHE_HOME=/tmp/unaltered-cache XDG_CONFIG_HOME=/tmp/unaltered-config node scripts/browser-network-check.mjs
```

On Chromium `154.0.8037.57` at `2026-10-24T14:51:03.589Z`, all three calendar POSTs and pending GETs and both explorers'
height/header GETs failed with `net::ERR_TUNNEL_CONNECTION_FAILED`. No CSP violation occurred. The script exits 1 and
does not label these failures as CORS success. It submits only random non-evidence commitments, never user files or names.
Its normal-host success would establish only pending-response reachability and genesis-header integrity; **a known anchored
receipt must still exercise a confirmed upgrade through the app and an independent reference verifier before R1 can close**.
No app backend, relay, new host, security exception or proxy was added. Repeat the commands on a host that permits these
destinations; retain the Oct 22 observations below as historical evidence.

The same probe subsequently ran on native CI [run 40104783971](https://github.com/djshellshoxxx/Unaltered/actions/runs/40104783971)
at `2026-10-24T14:58:34.311Z`, with pinned Chromium156.0.8078.4. Alice and Finney POSTs succeeded (200,207/226 bytes),
their pending GETs failed browser CORS reads (`TypeError`/`ERR_FAILED`), and Bob POST/GET timed out. Both explorers returned
the correct genesis height/hash/header with double-SHA-256 integrity verification. No CSP violation occurred. The parallel
Node diagnostic confirmed missing ACAO on the pending404 replies; these are now separate native Node and actual-browser
observations. Confirmed upgrade through the app/reference client remains untested. R1 is still open.

## 1. Calendar servers (OpenTimestamps)

Source: `opentimestamps/calendar.py` (python-opentimestamps 0.4.5) and `otsclient/cmds.py` (client 0.7.2).

| Operation | Request | Response |
|---|---|---|
| Submit | `POST <base>/digest`, body = the 32-byte commitment, `Accept: application/vnd.opentimestamps.v1` | `200`, a serialised timestamp tree (no file header) rooted at the commitment, normally one pending attestation |
| Upgrade | `GET <base>/timestamp/<lowercase hex commitment>`, same `Accept` | `200` tree with the Bitcoin attestation, or `404` while still pending |

The browser sends no custom headers beyond `Accept` (a CORS-safelisted header) and, for POST, no `Content-Type`, so no preflight is expected.

The commitment submitted is `sha256(fileDigest || 16 random bytes)` (per-file nonce, `os.urandom(16)` in the reference client),
or the root of a Merkle tree over several such values for batches. The calendar never sees the file digest.

## 2. Block explorers (Esplora API)

`mempool.space` and `blockstream.info` expose the Esplora API: `GET /api/block-height/<h>` returns the block hash as text;
`GET /api/block/<hash>/header` returns the 80-byte header as hex. The app reads the Merkle root (bytes 36-68, internal byte order,
which is what OpenTimestamps commits to) and the time (bytes 68-72, little-endian) from the header itself, and rejects a header
whose double-SHA-256 does not equal the hash the explorer claimed. The parser is tested against the real Bitcoin genesis block header
(`tests/unit/ots-flow.test.ts`).

## 3. Live results

Observed at 2026-10-22 14:42:39 UTC with Node 24, using `node --use-env-proxy scripts/network-check.mjs` (the flag activates
the managed environment's existing proxy and preserves TLS verification). Without that flag this machine's direct DNS path
returned `EAI_AGAIN`. Each calendar received one random, non-evidence 32-byte commitment. The check exited 1:

| Host | Check | Status | Access-Control-Allow-Origin | Detail | Preflight | Result |
|---|---|---|---|---|---|---|
| alice.btc.calendar.opentimestamps.org | POST /digest | 200 | * | 207 bytes | OPTIONS 404 | PASS |
| alice.btc.calendar.opentimestamps.org | GET /timestamp/commitment | 404 | missing | pending | | FAIL |
| bob.btc.calendar.opentimestamps.org | POST /digest | 200 | * | 240 bytes | OPTIONS 404 | PASS |
| bob.btc.calendar.opentimestamps.org | GET /timestamp/commitment | 404 | missing | pending | | FAIL |
| finney.calendar.eternitywall.com | POST /digest | 200 | * | 191 bytes | OPTIONS 501 | PASS |
| finney.calendar.eternitywall.com | GET /timestamp/commitment | 404 | missing | pending | | FAIL |
| mempool.space | block-height/0 + genesis header | 200/200 | * | genesis header hash verified | | PASS |
| blockstream.info | block-height/0 + genesis header | 200/200 | * | genesis header hash verified | | PASS |

The application's POST uses only the safelisted `Accept` header, so it does not depend on OPTIONS support. A browser cannot
read a cross-origin `404` lacking `Access-Control-Allow-Origin`; it reports a network failure. The app keeps the existing pending
receipt and reports that calendar failure; it does not turn it into a confirmed proof. Confirmed `200` upgrade replies still need
a live browser check. Do not work around this with `no-cors`, disabled TLS verification, or an unreviewed relay.

## 4. If a host blocks browser calls (R1)

Options, in order of preference (SPEC section 9): (a) remove that host from `src/core/net/allowlist.ts` (the CSP is generated from
it) and use only hosts that allow CORS, provided at least two calendars and two explorers remain; (b) ship a CLI for stamping and keep
the browser for hashing and verification; (c) an optional relay, which adds a trusted party and needs its own ADR.
