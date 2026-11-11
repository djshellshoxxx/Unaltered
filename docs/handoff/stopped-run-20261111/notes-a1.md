# Workstream A1 notes (R1 liveness canary) — branch `ws/a-liveness`, base `6ff1cbd`

Kept up to date while working. Paths are relative to the worktree unless they start with `$SCRATCH`.

## 0. State when I started

- Branch had no commits beyond `6ff1cbd`; this file did not exist. Fresh start, nothing to continue.
- Baseline (`$SCRATCH_ROOT/logs/snap-summary.log`): vitest 603 passed / 5 skipped, node tests 128 pass / 2 skipped,
  Chromium e2e 117 passed / 1 skipped.
- Only Chromium is installed here (`/opt/pw-browsers`). Firefox and WebKit cannot be run in this container.
- Calendars and explorers are not reachable. PyPI is (used once, read-only, for a cross-check; see 2.3).

## 1. Design evaluation (written before any code)

### 1.1 The problem, precisely

`upgrade()` asks `GET <calendar>/timestamp/<commitment>`. For a commitment that is not confirmed the calendars answer
404 **without** `Access-Control-Allow-Origin`. `fetch` then rejects with an opaque `TypeError`; `netFetch` maps it to
`NET_FAILED`; `upgrade()` marks the calendar `unreadable`. The same `TypeError` is produced by: DNS/TCP/TLS failure,
offline, a firewall or content blocker, a refused redirect (`redirect: 'error'`), any other non-2xx reply without the
header (400, 429, 5xx), and a 2xx reply without the header. The browser gives the page nothing to tell these apart.

### 1.2 What a readable canary proves

A canary is one more `GET <calendar>/timestamp/<fixed old commitment>` to the same origin, through the same
transport, right after the unreadable lookup. If it is read and validates, then at that moment, from this page:

- the origin resolves, connects and completes TLS (so: not offline, not a host-level block, not a DNS failure);
- the `/timestamp/` route is being served by something that holds this old commitment's Bitcoin proof;
- success replies are readable under CORS (the header is present on 200).

So the earlier failure is unlikely to be an outage or a network block of that host. Because a confirmed commitment
would have produced a readable 200 (repository evidence for all three calendars), "unreadable lookup + readable
canary" means the calendar most likely answered the receipt's lookup with a non-2xx reply. For a receipt that an
honest client created recently, the usual such reply is the pending 404.

### 1.3 What it does not prove (this is why the copy must say "probably")

1. It does not prove the receipt's commitment is known to the calendar. The server sends 404 both for "pending" and
   for "not found"; both lack the header. A lost, forged or damaged receipt looks exactly the same.
2. It does not prove the receipt is pending. The lookup may have hit 400/429/5xx, or a transient network error.
   The two requests are separate in time.
3. It says nothing about Bitcoin. The canary's own Bitcoin attestation is **not** verified against a block header
   (no explorer request is made). It is only compared with pinned constants.
4. It is about one calendar at one moment. It says nothing about other calendars or about later.
5. A failing canary is **not** evidence of an outage. If a calendar ever pruned the canary commitment it would answer
   404 without the header and the canary would fail the same opaque way while the calendar is healthy. So the
   negative outcome is "unknown", worded as "may be unreachable or blocked", never "is down".

Asymmetry to keep in the UI: a passing canary is a fact ("answered a test request just now") plus a hedged inference
("probably still waiting for Bitcoin"); a failing canary is only the absence of that fact.

### 1.4 A real protocol limit the brief did not anticipate: a reply does not carry its commitment

The brief says "the parsed timestamp's commitment must equal the requested one". A calendar reply is a serialized
tree of operations and attestations **without** the root message. `parseTimestampBody(bytes, rootMsg)` roots the tree
at whatever commitment the caller passes, so "the parsed commitment equals the requested one" is true by
construction for every parsable reply. It cannot detect a reply that belongs to another commitment.

The only real bindings are (a) the URL that was requested (and no cache in between), and (b) a pinned property of
the genuine reply. What repository evidence records per calendar:

| Calendar | Commitment | Readable 200 | Block height | Merkle root the reply reaches | Reply bytes |
|---|---|---|---|---|---|
| Bob | yes (`r1-targets` `nonBrowserProbe.url`) | yes (probe + Chromium 156) | 429355 | yes (`bitcoin[0].commitment`, equals bytes 36..68 of the recorded header) | no (only length 733 and SHA-256) |
| Finney | yes (same record type) | yes (probe + Chromium 156) | 523367 | yes (same) | no (only length 953 and SHA-256) |
| Alice | yes, indirectly (see 2.1) | yes (Chromium 156, per receipt hash) | 428648 | **no** | no |

Decision: use the strongest binding the evidence supports, per calendar.

- Every canary: the reply must parse completely with the existing parser, rooted at the canary commitment, and
  contain a Bitcoin attestation **at the recorded height** on a 32-byte message.
- Bob and Finney: that message must also **equal the recorded Merkle root**. This is a cryptographic binding to the
  requested commitment (a different commitment cannot reach that root without a SHA-256 preimage). It is the only
  meaning "commitment equals the requested one" can really have.
- Alice: the evidence does not record the root, so the binding is height only. Weaker, stated in the docs, listed
  under UNVERIFIED, with a follow-up (the live qualification prints the root so that it can be pinned).

Why this is still honest for Alice: the claim made on a pass is only "this server answered a test request just now".
A CORS-readable 200 from Alice's TLS-authenticated origin whose body is a well-formed timestamp with a Bitcoin
attestation at exactly height 428648 cannot arise by accident. The root pin adds integrity of the calendar's data,
which is more than the claim needs.

Consequence for tests: a root-pinned canary cannot be satisfied by any synthetic reply (that is the point). Fixtures
must be synthetic (addendum rule 8) and the genuine replies are not in the repository. So:

- unit tests inject a synthetic canary table (test seam) and cover answered / mismatch with real root comparison;
- the mocked e2e shows the "reachable" state through Alice's canary (synthetic bytes at height 428648) and shows
  that forged Bob/Finney replies are rejected by the real build;
- Bob/Finney success against the real build is covered only by the live qualification (cannot run here).

### 1.5 False-liveness risks and what closes them

| Risk | Closed by |
|---|---|
| Browser HTTP cache answers (the server marks confirmed replies as cacheable) | transport already sets `cache: 'no-store'` (no cache read or write; the browser also sends `Cache-Control: no-cache` upstream). The canary uses `netFetch` unchanged. Unit test pins the request init. |
| Service worker answers | the app ships none (ADR-007) and its CSP `worker-src blob:` does not allow registering one. Extra guard: if the page is controlled by a service worker no canary is sent and the outcome is "unknown". |
| Redirect to something else | `redirect: 'error'` (existing). |
| Cookies / referrer | `credentials: 'omit'`, `referrerPolicy: 'no-referrer'` (existing). |
| Late reply | existing timeout (`NET_TIMEOUT`) means "unknown"; the view discards results of a cancelled attempt. |
| Oversized reply | existing 256 KiB transport cap and 1 MiB parser cap mean "unknown". |
| Malformed reply, or readable non-200 | "unknown". |
| Reply for another commitment | pinned height for all; pinned Merkle root for Bob and Finney. |
| Shared caches between browser and calendar | not closable from a page (a query string would make the server answer 400; a custom request header would need a preflight the servers do not answer). `no-store` makes the browser send `Cache-Control: no-cache`. Residual risk, documented. |

### 1.6 Does the design hold?

Yes, as a **hint** with the asymmetry of 1.3. It must never be an input to the proof. Requirements I derive:

- The canary outcome is its own type with states `answered` / `unknown`. No value overlaps `ProofStatus` or
  `VerifyState`. The module takes calendar URLs and a network policy only; it never sees a proof.
- `upgrade()` computes `ots`, `changed`, `status`, `calendars` first; the canary runs afterwards and its outcome
  leaves through a separate callback. `UpgradeResult` keeps its exact shape.
- Opt-in per call: only a caller that passes `onLiveness` causes canary requests. Existing callers and tests of
  `upgrade()` see zero behaviour change. (This also keeps the existing UI unit tests hermetic: they mock `upgrade`,
  so a view-level probe after `upgrade` would have made them hit the real network.)
- Only when the receipt is still without a Bitcoin attestation **and** a lookup was `unreadable` (`NET_FAILED`).
  A timeout or a readable HTTP error needs no canary. A confirmed receipt needs none.
- At most one request per calendar per attempt (calendars are de-duplicated), no retry, the upgrade's own abort
  signal and network policy, only calendars this attempt already contacted. CSP and allowlist untouched.

### 1.7 Alternatives looked at

- Do nothing: keeps today's honest but uninformative "pending reply or network problem".
- Proxy / relay: rejected by ADR-001.
- Different provider: evidence (`cors-continuation-20261105`) shows the pools and Catallaxy fail the same way.
- Liveness by a throwaway `POST /digest` (readable 200 per evidence): rejected, it writes a junk commitment into a
  public calendar on every check. The canary is read-only.
- `mode: 'no-cors'` on the receipt's own lookup (resolves when any HTTP reply arrives): rejected. Standing policy
  forbids it (SPEC section 9, NETWORK.md), the single transport is `mode: 'cors'`, and an opaque reply cannot be
  validated at all, so a captive portal would count as "alive".
- Upstream fix (`add_header ... always`): the real fix, prepared by A2. With it the lookup becomes readable and the
  canary never fires (it only follows `NET_FAILED`).

## 2. Canary constants: where each value comes from

### 2.1 Evidence chain

- **Bob**: `docs/evidence/r1-targets-20261105.json` → `targets[bob].nonBrowserProbe`: URL with the commitment,
  `status 200`, `acao "*"`, 733 bytes, `bitcoin[0] = { height 429355, commitment 3e6c99ec… }`. The same file's
  `targets[bob].browser.requests[0]` shows Chromium 156 read the upgrade GET (200, `*`). `independentHeaders[bob]`
  has the 80-byte header; bytes 36..68 are that root and its double SHA-256 is the recorded block hash (recomputed
  in this run, see 2.3).
- **Finney**: same record types: commitment `5affdc4e…`, height 523367, root `f8065c3c…`, 953 bytes.
- **Alice**: `r1-targets-20261105.json` → `initialSameCommitmentProbe` names `57cfa5c4…b0e7` as the "Alice incomplete
  receipt commitment" of input receipt `95673f28…`. `docs/evidence/browser-20261105-network.json` →
  `confirmedAliceUpgrade` shows that same receipt (`fixtureSha256 95673f28…`) upgraded in Chromium 156 with one Alice
  GET (200, `*`) and verified at block 428648. No Merkle root and no reply digest are recorded for Alice.

### 2.2 Not used

- The second Alice commitment that the upstream README shows for `two-calendars.txt.ots` (`57d46515…`): no
  repository evidence of a readable 200, so it is not a candidate.

### 2.3 Cross-checks done in this run (not sources of constants)

- `node $SCRATCH/tools/recompute-bob.mjs`: recomputed the Bob commitment from the `ots info` text in the upstream
  client README (PyPI sdist `opentimestamps-client-0.7.2.tar.gz`, SHA-256 `083a08f5…` as listed by PyPI) with plain
  SHA-256. Result equals the evidence value. Both recorded headers hash to their recorded block hashes and contain
  the recorded roots.
- The 4-byte prefix of each commitment is the calendar's submission time and lies before the recorded block time
  (Alice 2016-09-07 05:29:40Z < block 428648 05:56:43Z; Bob 2016-09-10 < 2016-09-11; Finney 08:11:58Z < 09:22:13Z).

## 3. Decisions log

(appended below as the work proceeds)
