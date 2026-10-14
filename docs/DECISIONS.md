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
**Status:** Proposed (decide at M0-1)

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
