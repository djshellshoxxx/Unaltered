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

**Decision.** One lazily created Trusted Types policy (`unaltered-worker`, allowed in the CSP via `trusted-types unaltered-worker`) approves exactly the one URL the app is about to use. Multi-file: `./hasher.worker.js` (`worker-src 'self'`). Single-file: a `blob:` URL of the inlined worker source (`worker-src blob:`). If a Worker cannot start (e.g. multi-file over `file://` in Chrome) the identical chunked code runs on the main thread, yielding between 4 MiB chunks. The WebCrypto cross-check runs inside the worker so the main thread never copies the file.

**Consequences.** (+) Measured max main-thread gap about 12 ms while hashing 48 MiB in Chromium; no CSP violations. (-) Q7 is only answered for Chromium. Firefox and Tor Browser are untested; both fall back safely (no `trustedTypes` means the policy step is skipped, and a failed Worker falls back to the main thread).


---

## ADR-011: Per-OS packages and a CLI verifier, still without native executables
**Status:** Accepted (extends ADR-009)

**Context.** Users on Linux and macOS need the same no-install experience as Windows, and the release needs distinct, checkable artefacts per OS. A scriptable verifier was a listed later item (SPEC section 2).

**Decision.** `npm run build` also emits a Linux `.tar.gz` and a macOS `.zip` (launcher + checksum script each), and a single-file Node CLI bundle built from the same `src/core`. Archive writers live in `scripts/lib/archive.mjs` and are deterministic. The release workflow builds on all three OS runners and requires identical `SHA256SUMS`.

**Consequences.** (+) Three OS deliverables with no new dependency, no signing surface beyond `SHA256SUMS`. (+) CLI gives an independent, non-browser verification path. (-) macOS launcher is subject to Gatekeeper's first-run prompt; no dock/Applications integration. Native wrappers remain rejected unless a later ADR supersedes this.
