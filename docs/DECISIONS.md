# Architecture Decision Records

Format: Context → Decision → Consequences. Status: Proposed / Accepted / Superseded. New dependencies, endpoints, and format changes each need an ADR here.

---

## ADR-001: Client-only static app, no backend
**Status:** Accepted

**Context.** Any server we run is a subpoena target, a breach target, an identity trail (billing, logs), and something users must trust. The core operation (hash a file, call public services) does not need one.

**Decision.** Ship static files only. No accounts, database, API, or server-side logic. All network calls go from the browser to public third-party services on an allowlist.

**Consequences.** (+) Nothing to seize or breach on our side; can be hosted anywhere including IPFS; strongest privacy story. (−) We depend on third-party CORS policies (risk R1); we cannot add features that need server state; browser-delivered code is trust-on-first-use (mitigated by signed, hashed releases and an offline single-file build).

---

## ADR-002: Anchor via OpenTimestamps (Bitcoin) only for v0.1
**Status:** Accepted

**Context.** Options: (a) OpenTimestamps calendars anchoring to Bitcoin; (b) our own smart contract on an EVM chain; (c) RFC 3161 trusted timestamp authorities.

**Decision.** v0.1 uses OpenTimestamps only.

**Why.** (a) needs no wallet, no gas, no funds trail, no key handling by the app; proofs are free; the `.ots` format is an existing standard that independent tools can verify; no operator of ours is in the trust path. (b) forces users to hold funds and sign transactions (identity trail, key handling in the browser, higher risk) and makes us operators of a contract. (c) centralises trust in a CA/TSA; history shows CAs can be wholly compromised (DigiNotar, 2011) and a distrusted TSA invalidates proofs.

**Consequences.** (+) Simple, standards-based, minimal secrets. (−) Pending → confirmed takes hours; calendars are third-party; block time precision is coarse (stated in UI). Additional anchors can be added later via new ADRs.

---

## ADR-003: OTS codec, official JS package vs in-house minimal
**Status:** Accepted (in-house codec), 2026-10-14

**Context.** The official JS package was developed for Node and is documented as tested on very old Node versions (6/7), uses dated build tooling, and has no audit that we could find. A hand-written codec makes us responsible for a binary parser handling untrusted input.

**Decision criteria for M0-1.**
1. Does it run unmodified in a modern browser bundle with CSP `script-src 'self'` (no eval)?
2. Runtime dependency count and their maintenance state.
3. Can it be pinned and built reproducibly?
4. Does it round-trip and verify the reference corpus (generated with the Python `ots` client)?
5. Size and readability (can one person review it in a day?).

**Default if any of 1-3 fails:** in-house minimal codec, written against the Python reference, with differential and fuzz tests as exit criteria.

**Consequences.** Either path requires the differential test suite (`tests/differential`). We do not copy constants from secondary documents.

---

## ADR-004: Vanilla TypeScript, no UI framework
**Status:** Accepted

**Context.** The app has three screens. Frameworks add transitive dependencies, build complexity, and attack surface; a Ledger-style supply-chain incident through a UI dependency would compromise every user.

**Decision.** TypeScript + DOM APIs, a few small view helpers, `textContent` for all dynamic text.

**Consequences.** (+) Tiny bundle, easy review, trivial CSP. (−) More manual DOM code; needs discipline and tests for a11y.

---

## ADR-005: Allowlist-based, own-code metadata stripping; digest over the cleaned copy
**Status:** Accepted

**Context.** Metadata has exposed real people (location in photos; reporters' guidance warns that standard tools may miss fields and that embedded thumbnails can retain the uncropped image). Blocklist approaches fail when formats evolve. Also: stamping the original and later publishing a cleaned copy would make the receipt useless for the cleaned copy.

**Decision.** Write small JPEG and PNG rewriters that re-emit only allowlisted structures, verify their own output, and refuse malformed input. The hash and receipt are computed over the **cleaned copy**, which the user must download.

**Consequences.** (+) Fail-closed, auditable, fuzzable. (−) Orientation and ICC handling may change appearance (Q3, Q4); other formats are `unsupported` and warn; we own the parsers' bugs.

---

## ADR-006: Explorer quorum for in-app verification, local node for high-stakes
**Status:** Accepted

**Context.** Verifying a Bitcoin attestation needs trustworthy block header data. The official JS README itself says explorer-based verification is convenient but not as secure as a local node. A browser app cannot run a full node.

**Decision.** The app queries at least two independent explorers and requires agreement (L1); it labels the result accordingly and gives instructions for L2 (reference client + own node).

**Consequences.** (+) Usable by anyone. (−) L1 trusts the explorers not to collude or be simultaneously compromised; wording in the UI must not overclaim.

---

## ADR-007: No service worker or persistent storage in v0.1
**Status:** Accepted

**Context.** A service worker can serve stale or attacker-modified code persistently; storage can leak the existence of use on shared devices.

**Decision.** None in v0.1. Offline use is provided by the single-file build, which users save deliberately. Revisit with a full threat review.

**Consequences.** (+) Smaller attack surface; no persistence of a compromised version. (−) No installable PWA convenience.

**Outcome (ADR-003).** In-house codec (`src/core/ots`, about 600 lines). The official JS package was not adopted: criterion 2 (dated, Node-era dependency tree) and 3 (gulp build, not reproducible) fail, so per the default rule the codec is ours. Constants and layout were read from python-opentimestamps 0.4.5 / client 0.7.2 (`core/op.py`, `core/notary.py`, `core/timestamp.py`, `calendar.py`, `otsclient/cmds.py`), not from secondary sources. Exit criteria met: every reference fixture round-trips **byte-identically** (`tests/unit/codec.test.ts`), the reference implementation reads our output (differential test), and the parser is fuzzed with 3000+ mutations per run. Known-but-unsupported tags (SHA-1, RIPEMD-160, Keccak, reverse, hexlify, Litecoin, Ethereum) are recognised and refused with a specific message (fail closed, SR-12). Not yet done: comparison on proofs produced by real calendars (no network access when this was written; the `network-check` job and the first real stamp close this).

---

## ADR-008: Settings choose among built-in endpoints; no arbitrary custom hosts
**Status:** Accepted

**Context.** FR-13 says "choose calendars, explorers, and M". The CSP is a `<meta>` fixed at build time and `connect-src` is generated from `core/net/allowlist.ts`. A user-typed host would be blocked by the CSP, and loosening the CSP for arbitrary hosts would defeat the exfiltration protection that SR-1 exists to give.

**Decision.** Settings let the user select any subset of the built-in endpoints and set M (minimum 1). Adding a host is a source change (allowlist + CSP + SPEC + review).

**Consequences.** (+) The CSP stays the single guarantee that nothing else is contacted. (-) A user who wants a private calendar must rebuild; documented in `docs/RELEASE.md`.

---

## ADR-009: Windows is served by the offline HTML and a zip, not a native executable
**Status:** Accepted

**Context.** The product is a client-only web app (ADR-001). A native wrapper needs Electron/Tauri or a Node SEA binary: a large dependency tree, an auto-update and code-signing surface, and a second place for bugs, none of which serves the threat model.

**Decision.** Ship the single-file offline build and a reproducible zip with a double-click launcher and a PowerShell checksum helper. CI builds and tests on `windows-latest` and requires the Windows build to be byte-identical to the Linux build.

**Consequences.** (+) Nothing to install, nothing to sign except `SHA256SUMS`. (-) No Start-menu entry or file-association; revisit via ADR if users ask.

---

## ADR-010: Hash in a Worker, with a Trusted-Types-gated blob worker for the single-file build
**Status:** Accepted (Q7 partly resolved)

**Context.** FR-1 requires the main thread never block more than 50 ms and `require-trusted-types-for 'script'` (SR-1) makes `new Worker(url)` a policy-checked sink. Chrome blocks module scripts and Workers from `file://`.

**Decision.** One lazily created Trusted Types policy (`unaltered-worker`, allowed in the CSP via `trusted-types unaltered-worker`) approves exactly the one URL the app is about to use. Both builds start the worker from a `blob:` URL of the worker source inlined in the page script (`worker-src blob:`), so the worker inherits the page's CSP and Trusted Types, and its code is pinned by the SRI hash of `main.js` (multi-file) or the CSP hash of the inline script (single-file). If a Worker cannot start the identical chunked code runs on the main thread, yielding between 4 MiB chunks. The WebCrypto cross-check runs inside the worker so the main thread never copies the file.

*Amended 2026-11-04:* the multi-file build used to load `./hasher.worker.js` under `worker-src 'self'`. A worker loaded from its own URL takes its CSP only from that response's HTTP headers, never from the page's `<meta>` CSP, and static hosts send none; `new Worker(url)` also has no integrity check. That worker, which reads every file, therefore ran without `connect-src`, `script-src` or Trusted Types and could be changed without any SRI error. It is no longer shipped as a separate file.

**Consequences.** (+) Measured max main-thread gap about 12 ms while hashing 48 MiB in Chromium; no CSP violations. (-) Q7 is only answered for Chromium. Firefox and Tor Browser are untested; both fall back safely (no `trustedTypes` means the policy step is skipped, and a failed Worker falls back to the main thread).


---

## ADR-011: Per-OS packages and a CLI verifier, still without native executables
**Status:** Accepted (extends ADR-009)

**Context.** Users on Linux and macOS need the same no-install experience as Windows, and the release needs distinct, checkable artefacts per OS. A scriptable verifier was a listed later item (SPEC section 2).

**Decision.** `npm run build` also emits a Linux `.tar.gz` and a macOS `.zip` (launcher + checksum script each), and a single-file Node CLI bundle built from the same `src/core`. Archive writers live in `scripts/lib/archive.mjs` and are deterministic. The release workflow builds on all three OS runners and requires identical `SHA256SUMS`.

**Consequences.** (+) Three OS deliverables with no new dependency, no signing surface beyond `SHA256SUMS`. (+) CLI gives an independent, non-browser verification path. (-) macOS launcher is subject to Gatekeeper's first-run prompt; no dock/Applications integration. Native wrappers remain rejected unless a later ADR supersedes this.


---

## ADR-012: Audio metadata stripping (WAV, MP3) for creators
**Status:** Accepted (extends SPEC section 8)

**Context.** Musicians and producers are a natural user group: a stamped demo, stem or session bounce proves prior existence. Audio files routinely carry identity (artist/comment tags, cover art, broadcast `bext` originator and timestamps, DAW project paths in `iXML`).

**Decision.** Add allowlist rewriters for WAV and MP3 in `core/strip/audio.ts` (SPEC 8.2a), reusing the existing cleaned-copy-required flow. Loop/cue chunks (`smpl`, `inst`, `cue `) are kept because they are musical content, not identity. No new dependency.

**Consequences.** (+) Same security properties as image stripping, tiny code. (-) FLAC/AAC/OGG/AIFF remain unsupported and are warned about, not cleaned.

---

## ADR-013: Local binary QR transport for standard receipts
**Status:** Accepted; records the QR integration merged in #67 and its follow-up review on 2026-11-09.

**Context.** The owner requested a printable PDF certificate carrying a recoverable `.ots` receipt. QR encoding and pixel decoding require symbol placement, error correction, image location and sampling. Implementing these correctly in under 200 lines is not a reasonable alternative. The original digital receipt must remain usable by independent OpenTimestamps clients.

**Decision.** Reuse [Project Nayuki's QR encoder](https://github.com/nayuki/QR-Code-generator), vendored with its MIT notice, and [cozmo/jsQR](https://github.com/cozmo/jsQR) **1.4.0**, pinned with package integrity and its Apache-2.0 notice. The upstream projects maintain their respective libraries; Unaltered owns the local integration, bounds and update qualification. No independent security audit of either library is established by this review. The provenance and distribution notices are recorded in [DEPENDENCIES.md](DEPENDENCIES.md#archival-qr-completion--2026-11-08).

Encode the original receipt bytes in the versioned `UNALTERED-OTS-QR/1` framing documented in [ARCHIVAL_QR_PROTOCOL.md](ARCHIVAL_QR_PROTOCOL.md). Preserve binary payloads without text conversion. Reassembly requires a complete consistent frame set, receipt checksum and domain-separated identifier, followed by the existing `.ots` parser. This is an experimental transport for an unchanged standard receipt, not a new timestamp authority or OpenTimestamps standard.

Bundle both libraries locally. Decode images in a cancellable worker with byte, pixel, frame and time limits. Keep the existing CSP, network allowlist and no-CDN behavior. Use the browser's Print / Save as PDF function. Prefer saving the digital `.ots` receipt; QR images and paper certificates are supplementary backups, and verification also requires the original document.

**Consequences.** Independent encoding/decoding, shared Python golden vectors, generated parser properties, and A4/Letter PDF raster tests qualify the implemented path. These checks do not establish physical printer/camera reliability or Bitcoin confirmation. New library versions or framing changes require renewed review and qualification; unsupported compression/version flags fail closed. Practical print limits leave oversized receipts available digitally without truncation.

---

## ADR-014: Calendar liveness canary for unreadable pending upgrades
**Status:** Accepted for agent review on 2026-11-11; live browser qualification pending (see below).

**Context.** Risk R1. All three built-in calendars answer `GET /timestamp/<commitment>` for a pending or unknown
commitment with `404` and no `Access-Control-Allow-Origin`, so the browser surfaces an opaque `TypeError`, exactly as
for an outage or a blocked connection ([NETWORK.md](NETWORK.md), [evidence](evidence/cors-continuation-20261105.md)).
The cause is outside this repository: the published nginx example uses `add_header` without `always`
([proposal](proposals/OTS_SERVER_CORS.md)). Until now the Verify page could only say "either may be responsible".
A *completed* commitment's `200` does carry `Access-Control-Allow-Origin: *`. The recorded evidence shows a
browser-readable `200` on each calendar for one public commitment from an upstream example receipt:
Alice `57cfa5c4…4eb0e7` (block 428648; `incomplete.txt.ots`, receipt SHA-256 `95673f28…`; Chromium GET 200, ACAO `*`,
[browser-20261105-network.json](evidence/browser-20261105-network.json), commitment recorded in
[r1-targets-20261105.json](evidence/r1-targets-20261105.json) `initialSameCommitmentProbe`), Bob `57d46516…1b270a97`
(block 429355) and Finney `5affdc4e9ca8…1c930912` (block 523367), both with Node and Chromium GET 200, ACAO `*` in
r1-targets. The agent re-derived each commitment from the hash-matching upstream receipt with python-opentimestamps
0.4.5 on 2026-11-11; the calendars themselves were not reachable from that container. The evidence therefore supports a
canary for all three built-in calendars and for no other host.

**Decision.** When an upgrade leaves a receipt pending and a calendar's pending lookup was unreadable, the browser
Verify view asks that calendar once for its recorded canary commitment (`src/core/ots/liveness.ts`,
`StampConfig.liveness`, off by default and off in the CLI). It uses the same `netFetch` transport and policy
(allowlist, HTTPS only, no credentials, no referrer, no cache, redirects refused, 15 s, 256 KiB) and the same
`parseTimestampBody` parser and limits. The result is per calendar:

- `reachable`: status 200, the body parses as a timestamp rooted at the requested commitment, and it contains a
  Bitcoin attestation at the recorded height. Shown as "reachable … your receipt is **probably** still waiting for
  Bitcoin there".
- `unreachable`: the canary could not be read either (`NET_FAILED`) or timed out. Shown as "unreachable or blocked".
- `unknown`: no canary recorded, a readable non-200, a malformed, oversized or different timestamp (other height, or
  pending only), or a policy refusal. Fails closed: never "pending", never "reachable".

Cancellation propagates as `ABORTED`. The canary is never merged into the receipt and never changes `status`, `changed`
or the bytes offered for download; the existing pending and unreadable notices stay unchanged. At most one canary per
calendar per upgrade attempt, and none when the pending reply was readable or the receipt became Bitcoin-confirmed.

**Alternatives considered.**
(1) *Do nothing*: honest but leaves users unable to tell a blocked network from normal waiting, which is the commonest
case for every pending receipt. (2) *A relay or proxy that adds the header*: rejected by ADR-001 (a server of ours) and
SPEC section 9; it would also see every user's commitment and IP. (3) *A different calendar provider*: no source-documented
candidate was browser-qualified (Catallaxy's POST was unreadable, 2026-11-05), and ADR-008 makes a new host a reviewed
source change; it would not fix the three existing hosts. (4) *`no-cors` or reading opaque responses*: an opaque reply
exposes neither status nor body, so it cannot separate 404 from an outage and would only hide the problem.
(5) *The canary* (chosen): no new host, CSP entry or service, and no user data. A stronger pin on the attested Merkle
root was considered: it is recorded for Bob and Finney but not for Alice, and a synthetic reply cannot reach a real
Merkle root, so the pin is the recorded block height for all three. That is enough for a reachability hint, which never
contributes to verification.

**Consequences.** (+) Users see per calendar whether waiting is the likely explanation. (+) Privacy: the canary is a
fixed public commitment, so it reveals nothing about the user's file; it goes only to a calendar the same page has just
contacted, so it adds no new party. (−) Up to three extra requests per pending upgrade attempt, and the fixed canary
path makes the app's requests recognisable as Unaltered to calendar operators (the pending lookup already disclosed the
IP and timing). (−) "Reachable" does not prove that this receipt's `404` was a pending reply: it may also be "not found"
on that calendar, hence "probably". (−) A calendar that prunes or changes its old replies turns its canary `unknown`
(fail closed); the table then needs a new evidenced commitment. (−) A calendar could special-case the canary; the hint is
not evidence and is not used as such. The preferred fix remains the upstream `always` change; once calendars send ACAO
on `404`, a readable 404 is shown as ordinary pending and no canary is sent. **Live qualification** (not possible from
the 2026-11-11 container, whose proxy refuses the calendars):
`npm run build && UNALTERED_LIVE_LIVENESS=1 npx playwright test tests/e2e/liveness-live.spec.ts --retries=0` on a host
that reaches the calendars must show all three as reachable.
