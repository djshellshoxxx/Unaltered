# Network facts (M0-3)

## Liveness canary for unreadable pending upgrades — 2026-11-11 UTC

[ADR-014](DECISIONS.md#adr-014-calendar-liveness-canary-for-unreadable-pending-upgrades). Pending `404` replies remain
unreadable in browsers (below). When an upgrade leaves a receipt pending and a calendar's lookup was unreadable, the
Verify page now asks **that calendar** once for a fixed public commitment whose completed `200` reply carries
`Access-Control-Allow-Origin: *` in the recorded evidence:

| Calendar | Canary `GET /timestamp/<commitment>` | Recorded block | Evidence of a browser-readable 200 |
|---|---|---|---|
| alice.btc.calendar.opentimestamps.org | `57cfa5c46716df9bd9e83595bce439c58108d8fcc1678f30d4c6731c3f1fa6c79ed712c66fb1ac8d4e4eb0e7` | 428648 | [browser-20261105-network.json](evidence/browser-20261105-network.json) `confirmedAliceUpgrade` (Chromium GET 200, ACAO `*`); commitment in [r1-targets](evidence/r1-targets-20261105.json) `initialSameCommitmentProbe` |
| bob.btc.calendar.opentimestamps.org | `57d4651676e9ac3b3b57c1584828ea5162979c96483a03c87c69a1b8614d1cbaf387e0f5647b90ea1b270a97` | 429355 | [r1-targets](evidence/r1-targets-20261105.json) target `bob` (Node and Chromium GET 200, ACAO `*`) |
| finney.calendar.eternitywall.com | `5affdc4e9ca8db900367fd8d74967d67d57dbad0f3cdc715d217dfd5d07a4dbb1eacec03384e62331c930912` | 523367 | [r1-targets](evidence/r1-targets-20261105.json) target `finney` (Node and Chromium GET 200, ACAO `*`) |

Each commitment is the pending commitment that calendar itself issued in an upstream example receipt
(`opentimestamps-client` `incomplete.txt.ots` and `two-calendars.txt.ots`, `javascript-opentimestamps` `osdsp.txt.ots`;
LGPL-3.0-or-later; only the hex is used). On 2026-11-11 the commitments were re-derived with python-opentimestamps 0.4.5
from upstream receipts whose SHA-256 matches the recorded `95673f28…`, `1f0fe002…` and `080ccfea…`.
`tests/unit/ots-upgrade-liveness.test.ts` binds the table to the evidence files.

- **Result per calendar.** *Reachable*: the reply reads, parses with the normal calendar parser and contains a Bitcoin
  attestation at the recorded height. The page says the receipt is *probably* still waiting for Bitcoin there.
  *Unreachable or blocked*: the canary could not be read either, or timed out. *Unknown*: anything else, including a
  malformed or different timestamp; never "pending". The canary never changes the receipt, its status or verification.
- **Privacy and limits.** A fixed public commitment reveals nothing about the user's file. It goes only to an allowlisted
  calendar the page has just contacted, through the same `netFetch` policy (HTTPS only, no credentials or referrer,
  `cache: no-store`, redirects refused, 15 s, 256 KiB). At most one canary per calendar per upgrade attempt, so at most
  three extra requests; none when the pending reply was readable or the receipt became confirmed. The CSP, allowlist and
  hosts are unchanged. The fixed canary path does make the request recognisable as this app to the calendar operator.
- **Qualification.** Mocked Chromium: `tests/e2e/upgrade-liveness.spec.ts` (both UI states, EN/ES). Unit:
  `tests/unit/ots-upgrade-liveness.test.ts`, `tests/unit/ots-liveness-view.test.ts`. **Live browser qualification is
  outstanding**: the 2026-11-11 container's proxy refused the calendars (`ERR_TUNNEL_CONNECTION_FAILED`), and the app then
  correctly showed all three as "unreachable or blocked". On a host that reaches the calendars (CI `network-check`):

  ```sh
  npm run build && UNALTERED_LIVE_LIVENESS=1 npx playwright test tests/e2e/liveness-live.spec.ts --retries=0
  ```

  It uploads a synthetic pending receipt for a random commitment (no submission) and expects all three calendars to be
  reported reachable. The upstream fix that would make pending replies readable is in
  [proposals/OTS_SERVER_CORS.md](proposals/OTS_SERVER_CORS.md); it has not been sent to anyone.

## Current browser qualification — 2026-11-05 UTC

On integrated build `85f5bc962b80d2c4`, strict-CSP Chromium156 successfully upgraded historical
pending receipts separately through **Alice, Bob and Finney**, downloaded each upgraded receipt,
and verified Bitcoin blocks428648,429355 and523367 respectively. Pinned Python OpenTimestamps0.4.5
independently verified each same app-downloaded receipt against an80-byte header fetched separately
from blockchain.info. Exact input/output digests, source fixture commits, per-host requests, displayed
versus reference times and browser/source hashes are recorded in
[initial and integrated Alice evidence](evidence/browser-20261105-network.json),
[integrated qualification](evidence/browser-20261105-qualification.json), and
[target-isolated Bob/Finney evidence](evidence/r1-targets-20261105.json).

Bob/Finney qualification used each upstream fixture's genuine pending branch, preserving the
file digest and all commitment-path operations while removing other pending calendar hints in a
scratch receipt. Each run contacted only its target calendar. The application downloaded a new
receipt; independent verification checked that exact download. No new submission, route mock,
TLS/CORS bypass, application proxy or committed upstream fixture was used for these confirmed runs.
This establishes these hosts' confirmed paths on this Chromium build; it is explorer/reference-header
L1 evidence, not own-node/L2 verification or universal live-browser compatibility.

Fresh random non-evidence submissions to all three calendars returned200 in the actual browser,
and both explorers returned genesis headers whose double-SHA256 matched. Fresh pending lookups
still failed browser reads. Separate timed header probes found404 with no Access-Control-Allow-Origin
on all three calendars. **Pending404 CORS remains an external interoperability limitation**: browser
code cannot distinguish that response from an outage. The app must keep its conservative pending/
unreadable state, retain original receipts and permit later upgrades. No backend or security exception
was introduced to hide this limitation. Older statements that Bob/Finney confirmed paths are untested
are superseded only for the exact build and evidence above.

Current publication addendum: [final handoff and raw evidence](FINAL_HANDOFF_20261030.md).

### Current consolidation evidence — 2026-10-30

Source `d09c2401839ea5a06fd794c9666d439b17e500e4`, [PR34](https://github.com/djshellshoxxx/Unaltered/pull/34).
Native [R1job124450996370](https://github.com/djshellshoxxx/Unaltered/actions/runs/41171752457/job/124450996370)
checked out31369ca8e82ca077abdc1dfa8489a30fbe665902; fetched full tree equals the source checkpoint. Real pinned Chromium156
Upgrade/Verify returned PASS at block428648 on the existing2016 Alice receipt. Python OpenTimestamps0.4.5 independently
verified that same app-downloaded receipt: digestMatches=true, verifiedTime1473227803, ok=true, pending0. No new calendar
submission was made by this R1 procedure. This closes the Alice confirmed-path question for this source tree only.

Bob/Finney confirmed browser responses, pending404 CORS and broader R1 compatibility remain open. A proposed optional
Bob/Finney classifier was omitted after review showed it could infer confirmation from a readable200 plus another calendar's
success. HTTP200 alone and Node-only traffic are not per-target browser/reference proof. No host/CSP/allowlist change,
backend, relay, no-cors mode, TLS/browser-policy bypass or new credential was introduced.

Upgrade marks NET_FAILED as unreadable and ok:false; it cannot distinguish browser CORS blocking from an outage. The
current notice says either may be responsible, and that the receipt is still pending. It avoids claiming unchanged proof
bytes when another calendar legitimately adds pending proof data. All-failure input bytes remain unchanged and no network
failure confers confirmation or VERIFIED. Readable404 receives the ordinary pending notice. Spanish text remains a draft.

Local final-source attempt: Chromium154, TLS_OR_PROXY, Alice GET failed ERR_TUNNEL_CONNECTION_FAILED, PENDING, no download,
no CSP violation. Independent blockchain.info header retrieval also HTTP403. Pinned-browser CDNs and Sigstore TUF metadata
were denied by this executor's destination policy; those are environment observations, not evidence about calendar CORS.
Repeat `scripts/r1-acceptance.mjs` plus the independent check in R1_ACCEPTANCE.md on an authorized path; native source evidence
above is distinct from local failure. [Current full ledger and recovery](CONSOLIDATION_20261030.md) tracks final-head status.

All older dated records below, including the imported PR30 proposal, are historical and superseded where this section differs.


### Native confirmed-path evidence — 2026-10-28

At source`887e724ba26a3706f404500001a9697dea26ba19`, native CI40719843975/job122927426163 exercised the built app's real
UI in pinned Chromium156.0.8078.4 with its normal CSP and no route mocks, proxy addition or CORS bypass. The pre-existing
upstream incomplete receipt was upgraded through Alice: GET200, ACAO`*`, upgraded receipt downloaded. Both Esplora hosts
returned200 with ACAO`*`; the app returned VERIFIED at block428648. Python OpenTimestamps0.4.5 checked that same downloaded
receipt against the independently fetched header: digestMatches=true, verifiedTime1473227803, ok=true. No new calendar
submission was made by this acceptance procedure. See [the exact native log](https://github.com/djshellshoxxx/Unaltered/actions/runs/40719843975/job/122927426163).

This establishes the Alice confirmed upgrade/app/reference path for that source. It does not establish Bob/Finney confirmed
upgrade compatibility, browser pending404 compatibility, own-node verification or all browsers. The separate informational
live check still fails; pending404 replies still lack ACAO. Those R1 residuals remain open; older notes below are historical.
The job's old style-based diagnostics reported confirmed=false and mislabeled the new neutral notice as an unknown-calendar
warning even though download/VERIFIED/reference evidence succeeded. The following diagnostic correction derives confirmation
from Verify and excludes status notices from unknown-calendar warnings; the live result is not inferred from those CSS labels.

### Historical status — 2026-10-22

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

### Confirmed-upgrade reply — 2026-10-27 (Node; browser pending)

First observation of a **confirmed `200`** upgrade reply, using the upstream already-anchored `incomplete.txt.ots` example
(no new submission; procedure in [R1_ACCEPTANCE.md](R1_ACCEPTANCE.md)). From Node 22.22.0 at about 21:45 UTC:
`GET alice.btc.calendar.opentimestamps.org/timestamp/<commitment>` returned `200`, `Access-Control-Allow-Origin: *`,
699 bytes. This project's `upgrade()` produced a `bitcoin-confirmed` receipt and `verify()` returned `VERIFIED` at block
428648 (`2016-09-07T05:56:43Z`, mempool.space and blockstream.info agreeing). The reference library (0.4.5) independently
verified that receipt against block 428648's header from blockchain.info: same time (1473227803), file digest matched.
The browser run on this executor failed before any HTTP reply with `net::ERR_CERT_AUTHORITY_INVALID` (the executor
inspects TLS with a CA the browser does not trust), so it says nothing about CORS. The new informational CI job `r1-acceptance` runs the
same procedure on native runners. **R1 stays open** until a browser `PASS` and the reference check agree on one receipt.

### Historical PR30 proposal — 2026-10-30 (current consolidation status above supersedes this proposal)

Decision: option (b), "pending, check later". Hosts, CSP and allowlist are unchanged; no relay, `no-cors` or proxy.
A browser cannot tell a pending `404` without `Access-Control-Allow-Origin` from an outage: both surface as a `fetch`
`TypeError`, which `netFetch` reports as `NET_FAILED`. During **upgrade only**, such a calendar result is marked
`unreadable` (still `ok: false`; it is never treated as a confirmation, and the receipt is not changed). When the receipt
stays pending and any calendar was unreadable, the Verify page adds, under "Not confirmed yet. Try again in a few hours.":

> This browser could not read the answer from one or more calendar servers. While a receipt is still pending, calendar
> servers usually answer in a way browsers are not allowed to read, so this is expected. Your receipt is unchanged and
> still pending. Check again later.

The per-calendar failure list ("Could not reach a server.") is still shown. A confirmed `200` reply carries
`Access-Control-Allow-Origin: *` (observed 2026-10-27, Node), so the browser upgrade path is expected to work once Bitcoin
confirms; that remains unverified in a live browser (R1). The CLI has no `upgrade` command, so the copy does not point to it.
Spanish copy is a draft awaiting native-speaker review. Tests: `tests/unit/ots-flow.test.ts` (unreadable vs HTTP error),
`tests/e2e/app.spec.ts` (the e2e calendar mock now refuses CORS on pending `404`s, matching the live servers).

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

## Continuation: receipt-bound pending probes — 2026-11-05

The earlier random-commitment probe queried its submitted root directly. A calendar may append/hash that root before
placing a pending attestation on another node, so that lookup could be an unknown-root404 rather than the pending path
actually named by the returned receipt. Existing historical observations are preserved, but do not substitute for this
corrected receipt-bound test. Confirmed-upgrade evidence used actual receipts and is unaffected.

The corrected `scripts/browser-network-check.mjs` validates/replays the POST proof and follows each pending node's
commitment, constrained to existing application calendar origins. Its bounded shared transport and parser have seven
regressions passing on Chromium, Firefox and WebKit. Malformed proofs, unapproved origins, redirects, oversized replies,
timeouts and unverified Bitcoin metadata cannot produce a successful verification claim.

[Exact live results and source/licensing research](evidence/cors-continuation-20261105.md) show that canonical calendars,
reference-client pool aliases and alternate Accept headers still fail pending-response browser reads. Pool POST proofs
name the canonical calendars; substituting a pool origin was research-only and did not qualify. Catallaxy POST lacked
readable CORS too. App CSP/allowlist are unchanged, and no candidate was promoted.

The public upstream nginx example lacks `always` on its ACAO header, and nginx documents that ordinary `add_header`
omits404. This matches the observed mechanism; deployed private configuration was not inspected. Operators must make
appropriate CORS headers available on pending/error replies before that response becomes readable to this client-only
application. A source-derived trailing slash produced400, not a compatible alternate protocol route. No proxy, policy
bypass or operator communication was introduced. Pending/unreadable UI behavior and original receipt preservation remain
conservative; an outage is never promoted to Bitcoin confirmation.
