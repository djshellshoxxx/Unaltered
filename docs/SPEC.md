# Unaltered: Product and Technical Specification

**Version:** 0.1 (draft) | **Status:** ready for developer review | **Owner:** maintainers

Conventions: **MUST / SHOULD / MAY** follow RFC 2119. Requirement IDs (FR-x, NFR-x, SR-x) are referenced from `docs/TODO.md` and tests.
Items marked **[SPIKE]** rest on a claim not yet verified against primary sources; milestone M0 in `docs/BUILD_PLAN.md` resolves them before any dependent code is written.

---

## 1. Purpose

Let anyone prove that a specific file existed, byte for byte, **before** a given moment, without trusting Unaltered, a company, or a government, and without creating an account or uploading the file.

### 1.1 Non-goals

- Proving a file's contents are **true**, or who authored it.
- Anonymity at the network level. We reduce leaks; we do not hide the user's IP. See `THREAT_MODEL.md`.
- Hosting, storing, or sharing user files or receipts.
- Anonymous whistleblower submission (a separate, higher-risk product; out of scope).
- Naming, accusing, or aggregating claims about individuals.
- A custom proof format. We use standard OpenTimestamps (`.ots`).
- Any wallet, token, fee, or on-chain transaction signed by the user.

### 1.2 Users

| Persona | Need |
|---|---|
| **Documenter** (citizen, journalist, NGO worker) | Stamp evidence quickly; not leak location; keep a receipt safely |
| **Verifier** (editor, auditor, court, anyone) | Check a file against a receipt with minimal trust in the tool |
| **Developer / auditor** | Understand and reproduce the build; verify independently |

---

## 2. Scope by release

| Release | Contents |
|---|---|
| **v0.1 (MVP)** | Hash locally (FR-1,2), stamp via OTS calendars (FR-4,5), upgrade (FR-6), verify with explorer quorum (FR-7,8), JPEG/PNG metadata strip (FR-3), offline single-file build (FR-9), strict CSP, reproducible build, signed release |
| **v0.2** | Batch stamping (FR-10), local receipt list (FR-12), settings (FR-13), i18n (FR-14), PDF metadata warning, local-node verification instructions in-app |
| **Later** | Optional additional anchors, CLI verifier, attestations ("built vs promised") as a separate module |

---

## 3. Functional requirements

### FR-1 Local hashing
- The app MUST compute SHA-256 of the selected file entirely on the device.
- Hashing MUST run in a Web Worker, reading the `Blob` in chunks (default 4 MiB) using the incremental API (`sha256.create().update(chunk)...digest()`), so memory use does not scale with file size.
- The UI MUST show progress and allow cancel (`AbortSignal`).
- **Acceptance:** output equals `sha256sum` for all vectors in `tests/vectors/sha256.json`; a 2 GiB file hashes with peak extra memory below 200 MiB (measured in CI browser test); main thread never blocked for more than 50 ms.
- For files up to 64 MiB the app SHOULD also compute the digest with `crypto.subtle.digest` and MUST abort with an internal-error message if the two results differ (runtime differential check).

### FR-2 Fingerprint display
- Show the digest as lowercase hex, grouped in blocks of 8 for readability, with a copy button.
- Never truncate in a way that hides the middle without an expand control.

### FR-3 Metadata stripping (images)
- For JPEG and PNG the option "Remove hidden data (location, camera, etc.) before stamping" MUST default to **on**.
- When on, the app produces a **cleaned copy**, and the digest MUST be computed over the **cleaned copy**, not the original.
- The UI MUST make this unmistakable: "The receipt applies only to the cleaned copy. Download it and keep it together with the receipt." The user MUST download the cleaned copy before the stamp step is enabled.
- Unsupported file types (HEIC, PDF, video, Office files, anything else): the app MUST show "This file type may contain hidden data we cannot remove" and proceed only after the user explicitly acknowledges it. It MUST NOT claim the file is clean.
- Full policy: section 8.

### FR-4 Stamp
- Submit the digest to the configured OpenTimestamps calendar servers in parallel.
- Succeed when at least **M = 2** calendars accept (configurable, never below 1). Otherwise show which calendars failed and why.
- Follow the reference client's behaviour for privacy nonces and for merging multiple calendar responses into one proof. **[SPIKE M0-2]** confirm exact reference behaviour by reading `python-opentimestamps`.
- The only randomness the app uses is `crypto.getRandomValues` for the per-stamp nonce, if the reference client uses one. The app MUST NOT generate, store, or handle keys, passwords, or accounts.

### FR-5 Receipt
- Output is a standard `.ots` file named `<original-name>.ots` (user can rename).
- Immediately after stamping the receipt is **pending** (calendar promises only). The screen MUST say: "Pending: not yet proof. Come back in a few hours and press Upgrade."
- The screen MUST say, prominently: "Keep this receipt. We do not store it."
- The app MUST NOT write the receipt anywhere except a user-initiated download.

### FR-6 Upgrade
- Input: a pending `.ots`. The app contacts the calendars named inside the proof and, if Bitcoin confirmation is available, produces an upgraded `.ots` for download.
- Reference client keeps a backup of the old file when upgrading; the web app has no file system, so it MUST offer the upgraded file as a **new download** and never imply the old file was modified.

### FR-7 Verify
Inputs: the original (or cleaned) file and a `.ots` receipt.

1. Hash the file (FR-1).
2. Parse the proof (section 6). Reject malformed input with a specific error.
3. Check that the proof's starting digest equals the file's digest. If not: **NO MATCH (file differs from the one stamped)**.
4. Replay the proof operations to obtain the commitment for each attestation.
5. For each Bitcoin attestation: obtain the block header's Merkle root for the claimed height from **at least two independent sources** (section 9). All sources MUST agree with each other and with the replayed commitment. Any disagreement: **COULD NOT VERIFY (sources disagree)**, never a pass.
6. Show: result, block height, block time (UTC) with the caveat in 3.1, and the trust level (FR-8).
7. A proof with only pending attestations MUST show **NOT YET CONFIRMED**, never "match".

Result states (exhaustive, each with distinct wording and colour **plus** icon and text, not colour alone):

| State | Meaning |
|---|---|
| `VERIFIED` | File matches; Bitcoin attestation confirmed by quorum |
| `PENDING` | File matches; not yet anchored in Bitcoin |
| `NO_MATCH_FILE` | Proof is valid but is for a different digest |
| `INVALID_PROOF` | Proof malformed or operations do not lead to the attestation |
| `SOURCES_DISAGREE` | Explorers disagree; do not trust |
| `UNREACHABLE` | Could not reach enough sources; try again or verify locally |

### FR-8 Trust levels and independent verification
- The result screen MUST state the trust level:
  - **L1 Explorer quorum** (what the app does): trusts that at least two independent block explorers are not colluding or both compromised.
  - **L2 Local Bitcoin node** (recommended for important cases): verify with the reference `ots` client against your own node. The app MUST show copy-pasteable instructions.
- The app MUST NOT call L1 "proof" without this qualification visible on the same screen.

### FR-9 Offline and single-file build
- Hashing and stripping MUST work with no network.
- The release MUST include a **single self-contained HTML file** (inline script and style allowed only in this build, with hashes in CSP; see SR-3) that can be saved and run offline. Its SHA-256 is published in `SHA256SUMS`.

### FR-10 Batch stamping (v0.2)
Hash many files, build a Merkle tree, stamp the root once, and emit one `.ots` per file. **[SPIKE]** use reference client's multi-file approach; do not invent a tree format.

### FR-11 Share link (optional, v0.2)
A URL whose **fragment** (`#h=<hex>`) carries only the fingerprint. The fragment is never sent to a server. Visiting it pre-fills the fingerprint in the Verify screen. MUST NOT include filenames.

### FR-12 Local receipt list (v0.2, opt-in)
Stores only `{digestHex, createdAtUtc, label}` in `localStorage`, wrapped in try/catch, only if the user turns it on. File names are not stored unless the user types a label. App MUST work with storage unavailable.

### FR-13 Settings (v0.2, advanced)
Choose calendars, explorers, and M. Shows a banner "Custom endpoints change who sees your activity." Defaults restore with one click.

### FR-14 Accessibility and language
- WCAG 2.2 AA. Full keyboard operation. Screen-reader labels on drop zone and results.
- Plain language: say "fingerprint" and "receipt". Technical terms live in an expandable "Details" section.
- All strings in one module for translation.

### 3.1 Time semantics (must appear in UI help)
Bitcoin block timestamps are set by miners and are only constrained loosely by consensus rules (greater than the median of recent blocks, and not more than about two hours ahead of network time). Unaltered therefore says: "This file existed **no later than** about this time", never "created at".

---

## 4. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | No backend. All logic client-side. Static files only. |
| NFR-2 | Runtime dependencies: only those in `DEPENDENCIES.md` marked **Approved**. Target: 1 (`@noble/hashes`), possibly 0 additional. |
| NFR-3 | Bundle size (v0.1) below 150 KiB gzip excluding fixtures. |
| NFR-4 | Browsers: current and previous major of Chrome, Firefox, Safari, Edge. Tor Browser (Firefox ESR) MUST work, including with JavaScript JIT restrictions. |
| NFR-5 | Works from `file://`, from an HTTPS host, and from IPFS gateway paths (relative URLs only; no absolute paths). |
| NFR-6 | No cookies, no `localStorage` by default (only FR-12 when enabled), no IndexedDB, no service worker in v0.1. |
| NFR-7 | Deterministic, reproducible build: two clean builds from the same commit produce byte-identical output. |
| NFR-8 | Mobile layout works at 360 px width; touch targets at least 44 px. |

---

## 5. Architecture

```
                         static files (HTML/JS/CSS, no server logic)
 ┌──────────────────────────────── Browser tab ──────────────────────────────────┐
 │  UI (src/ui)        textContent only; no innerHTML                             │
 │    │                                                                           │
 │    ├─► core/strip ──► cleaned Blob (JPEG/PNG allowlist rewriter)               │
 │    │                                                                           │
 │    ├─► core/hash ───► Web Worker: @noble/hashes sha256 (+ WebCrypto cross-check)│
 │    │                                                                           │
 │    ├─► core/ots ────► codec (parse/serialise .ots) · ops · calendar client     │
 │    │                  · verify (replay ops, compare to block header)           │
 │    │                                                                           │
 │    └─► core/net ────► ONLY place that calls fetch(); host allowlist; timeouts  │
 └───────────────┬──────────────────────────────────────────┬────────────────────┘
                 │ HTTPS (digest only)                      │ HTTPS (block header lookups)
        OTS calendar servers                       ≥2 independent block explorers
```

### 5.1 Repository layout

```
src/
  index.html               CSP-first page shell (no inline script in the normal build)
  main.ts                  wires UI to core; no business logic
  ui/                      views, strings.ts, a11y helpers
  core/
    errors.ts              typed error taxonomy
    hash/hasher.ts         main-thread API; spawns worker
    hash/hasher.worker.ts  streaming SHA-256
    ots/types.ts           Op, Attestation, Timestamp, ProofStatus
    ots/codec.ts           parse/serialise .ots (bounded, no recursion on untrusted depth)
    ots/ops.ts             append/prepend/sha256 ops
    ots/calendar.ts        submit + upgrade against calendars
    ots/verify.ts          replay ops, compare with chain data
    ots/bitcoin.ts         block header sources + quorum logic
    strip/detect.ts        magic-byte file type detection (never trust extension)
    strip/jpeg.ts          allowlist rewriter
    strip/png.ts           allowlist rewriter
    net/allowlist.ts       the only list of permitted hosts
    net/fetch.ts           fetch wrapper: allowlist, timeout, size cap, no credentials, no referrer
tests/
  vectors/                 known-answer tests
  fixtures/                synthetic images/proofs only (never real-world files)
  unit/ property/ e2e/ differential/
scripts/
  build.mjs                deterministic build (esbuild), SRI + CSP hash generation
  opsec-check.sh           identity/metadata leak check
```

### 5.2 Module interfaces (TypeScript, normative)

```ts
// core/hash
export interface HashResult { digest: Uint8Array /* 32 bytes */; hex: string; bytes: number }
export function hashBlob(
  blob: Blob,
  opts?: { signal?: AbortSignal; onProgress?: (bytesDone: number) => void }
): Promise<HashResult>;

// core/strip
export type StripOutcome =
  | { kind: 'cleaned'; format: 'jpeg' | 'png'; output: Blob; removed: string[] }
  | { kind: 'unsupported'; reason: string }          // caller MUST warn the user
  | { kind: 'rejected'; reason: string };            // malformed: caller MUST refuse
export function stripMetadata(blob: Blob): Promise<StripOutcome>;

// core/ots
export interface CalendarResult { url: string; ok: boolean; error?: string }
export interface StampResult { ots: Uint8Array; calendars: CalendarResult[] }
export function stamp(digest: Uint8Array, cfg: StampConfig): Promise<StampResult>;

export type ProofStatus = 'pending' | 'bitcoin-confirmed';
export function upgrade(ots: Uint8Array, cfg: StampConfig):
  Promise<{ ots: Uint8Array; changed: boolean; status: ProofStatus }>;

export type VerifyState =
  | 'VERIFIED' | 'PENDING' | 'NO_MATCH_FILE'
  | 'INVALID_PROOF' | 'SOURCES_DISAGREE' | 'UNREACHABLE';
export interface VerifyReport {
  state: VerifyState;
  bitcoin?: { height: number; blockTimeUtc: string; sourcesAgreeing: string[] };
  detail: string;                                    // human-readable, no raw stack traces
}
export function verify(fileDigest: Uint8Array, ots: Uint8Array, cfg: VerifyConfig): Promise<VerifyReport>;
```

---

## 6. Receipt format and parser rules

- The receipt is the **standard OpenTimestamps `.ots` file**. We implement, we do not redesign. **[SPIKE M0-1]** decide between (a) the official `opentimestamps` JS package, (b) a minimal in-house codec written against the reference Python implementation. See ADR-003.
- Whatever codec is used, the parser handles **untrusted input** and MUST:
  - enforce a maximum input size (default 1 MiB) and maximum operation count and nesting depth (iterative traversal, no unbounded recursion);
  - reject unknown attestation or operation tags by marking the proof `INVALID_PROOF` (fail closed), never skipping silently;
  - treat all lengths as untrusted and bounds-check before allocating;
  - never `eval` or construct code from proof contents;
  - be exercised by property tests and a fuzz corpus (section 12).
- The pending attestation names a calendar URL **inside the proof**. The app MUST NOT contact any URL not on the allowlist (section 9). A proof pointing elsewhere is shown as "pending with unknown calendar" and is not upgraded automatically.

---

## 7. Data flows

**Stamp:** pick file → (optional strip, download cleaned copy) → hash in worker → show fingerprint → user presses Create Receipt → `net` posts digest (nonce handling per FR-4) to calendars → merge → offer `.ots` download → show "pending" guidance.

**Upgrade:** drop `.ots` → parse → for each pending attestation on an allowlisted calendar, request completion → merge → offer new `.ots` download.

**Verify:** drop file and `.ots` → hash → parse → compare start digest → replay ops → block header quorum → report.

At no step does the file, its name, or its metadata cross the network.

---

## 8. Metadata stripping policy (normative)

**Principle:** allowlist, never blocklist. Re-emit only parts known to be safe. Anything unknown is dropped; anything malformed causes refusal.

### 8.1 JPEG
Keep: SOI, DQT, DHT, SOF0-SOF15 (excluding DHT/JPG/DAC marker codes), DRI, SOS and its entropy-coded data, RSTn, EOI, APP0 only if it is a valid JFIF header, APP14 "Adobe" (needed for correct colour transform).
Drop: APP1 (EXIF, XMP, including embedded thumbnails and MakerNotes), APP2 (ICC and MPF: **default drop**, see open question Q3), APP3-APP13 (including Photoshop IRB/IPTC in APP13), APP15, COM, and **any bytes after EOI** (can hide appended data or secondary images).
Self-check: re-parse output and assert only allowlisted markers remain.
Orientation: removing EXIF Orientation can change how the image displays. If the original has Orientation other than 1, the UI MUST warn and offer to proceed. A lossy re-encode path is a possible later option, not v0.1. **[Q4]**

### 8.2 PNG
Keep: signature, IHDR, PLTE, tRNS, IDAT, IEND, and sRGB (rendering intent).
Drop: all other chunks (including eXIf, tEXt, zTXt, iTXt, tIME, iCCP, pHYs, bKGD, gAMA, cHRM and any private chunk) and any bytes after IEND.
Verify every chunk CRC. Animated PNG (acTL/fcTL/fdAT) → `unsupported`.

### 8.2a Audio (WAV, MP3) — v0.3, ADR-012
Normative rules, same fail-closed contract as 8.1/8.2; the digest is computed over the cleaned copy only.
- **WAV (RIFF/WAVE).** Chunk allowlist: `fmt `, `data`, `fact`, plus musical loop/cue data `smpl`, `inst`, `cue `. Everything else is removed (`LIST/INFO`, `bext`, `iXML`, `id3 `, `_PMX`, unknown). `fmt ` must precede one `data`; chunk lengths must fit inside the RIFF size; odd-chunk pad bytes are rewritten as zero; the RIFF size is recomputed; bytes after the RIFF end are dropped. RF64 is *unsupported* (never called clean).
- **MP3.** Remove leading ID3v2 tags (up to 8, honouring the footer flag and zero padding), a trailing APEv2 tag, and a trailing ID3v1 tag. A valid MPEG Layer III frame sync must follow; otherwise *rejected*. Audio frames are copied byte-for-byte.
- **Stated limits.** Audio watermarks, encoder strings inside the Xing/Info frame, and anything inside audio frames or `data` samples are not inspected. Other audio formats (FLAC, AAC/M4A, OGG, AIFF) are *unsupported* and require the hidden-data acknowledgement.
- **Tests.** `tests/unit/audio.test.ts`: secrets absent after cleaning, idempotence, byte-stability, malformed/truncated/oversized-length rejection.

### 8.3 Limits we state to users
- Stripping removes **metadata**, not **content**. Faces, landmarks, shadows, visible text, and sensor-noise patterns (which can link a photo to a specific camera) are unaffected.
- Copies uploaded elsewhere may keep their own metadata.
- File name and file timestamps are outside the file's bytes; the cleaned copy is offered under the user's chosen name, and the UI warns that names can identify.
- Screenshots of the image are sometimes safer than any tool for high-stakes cases (per journalists' practice in the research).

---

## 9. Network policy

All network I/O goes through `core/net/fetch.ts`, which:
- permits only hosts in `core/net/allowlist.ts` and mirrors the same list in CSP `connect-src`;
- uses `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `cache: 'no-store'`;
- enforces a timeout (default 15 s), a response size cap (default 256 KiB), and HTTPS only;
- never logs request bodies.

**Initial allowlist (verify each in M0-3 before committing):**

| Role | Host | Status |
|---|---|---|
| Calendar | `alice.btc.calendar.opentimestamps.org` | seen in official JS README example |
| Calendar | `bob.btc.calendar.opentimestamps.org` | seen in official JS README example |
| Calendar | `finney.calendar.eternitywall.com` | seen in official JS README example |
| Block explorer | `mempool.space` | **[SPIKE]** confirm CORS and API shape |
| Block explorer | `blockstream.info` | **[SPIKE]** confirm CORS and API shape |

**Top technical risk (R1):** calendar servers or explorers may not send CORS headers allowing browser calls. If any required host blocks browser requests, options are: (a) use only hosts that allow CORS, (b) ship a CLI for stamping and keep the browser for hashing and verification, (c) an optional relay (rejected by default, because it adds a trusted party; needs its own ADR).

**Privacy of network calls:** calendar and explorer operators and the network path see the user's IP address and timing. Docs MUST recommend Tor Browser or a trusted VPN for sensitive use, and MUST NOT claim anonymity.

---

## 10. Security requirements

| ID | Requirement |
|---|---|
| SR-1 | CSP: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src <allowlist>; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; require-trusted-types-for 'script'`. Delivered as header where the host allows it, and as `<meta>` otherwise (meta cannot set `frame-ancestors`, so framing protection needs a header or a frame-busting check). |
| SR-2 | No third-party origin loaded at runtime: no CDN, fonts, analytics, or widgets. |
| SR-3 | Subresource Integrity on every script and stylesheet reference in the multi-file build. The single-file build puts script and style inline and lists their hashes in CSP (`'sha256-…'`); there is no `'unsafe-inline'`. |
| SR-4 | No `eval`, `new Function`, `innerHTML`, `document.write`, inline event handlers. Enforced by ESLint rules and Trusted Types (where the browser supports it; treat as defence in depth). |
| SR-5 | Dependencies pinned exactly; lockfile committed; installs use `npm ci --ignore-scripts`; provenance verified where available (`docs/OPSEC.md`). |
| SR-6 | Reproducible build (NFR-7); CI builds twice and diffs. |
| SR-7 | Release artefacts are hashed and signed; verification instructions published. |
| SR-8 | Errors shown to users are generic and actionable; no stack traces, file names, or paths in UI or logs. No `console.log` of user data. |
| SR-9 | Parsers (`codec`, `jpeg`, `png`) have fuzz and property tests and run with size/depth/count caps. |
| SR-10 | All decisions that could produce a false "VERIFIED" are covered by a negative test (mutated file, mutated proof, disagreeing sources, truncated proof, wrong calendar). |
| SR-11 | `rel="noreferrer noopener"` on all external links; no autofill or form data collection. |
| SR-12 | Hash agility: SHA-256 only. SHA-1 MUST NOT be accepted for new stamps. Verification of proofs using other digests is rejected in v0.1 unless explicitly added with an ADR. |

---

## 11. UX requirements (screens)

Three primary views (`Stamp`, `Verify`, `About / How to check independently`). Wireframes were agreed in the project discussion and are reproduced in `docs/UX.md` once designed (task UX-1).
Mandatory copy blocks (final wording reviewed by a non-technical reader):
1. "Your file stays on your device. Only its fingerprint is used."
2. "A receipt proves a file existed unchanged. It does not prove the file is true."
3. "Keep your receipt. We don't store it."
4. "Pending is not proof yet."
5. "Stamping is visible to the servers you contact. For sensitive use, use Tor Browser."

---

## 12. Test strategy

| Layer | What | Tooling (see DEPENDENCIES.md) |
|---|---|---|
| Known-answer | SHA-256 vectors incl. empty, "abc", pangram, 1,000,000 × "a" | `tests/vectors/sha256.json` |
| Unit | each core module | Vitest |
| Property | strip never outputs forbidden markers/chunks; strip is idempotent; hash(stream) equals hash(one-shot) for random chunkings; codec round-trips | fast-check |
| Fuzz | codec, JPEG, PNG parsers with mutated corpora; no crash, no hang, bounded memory | fast-check with mutation, plus a coverage-guided fuzzer in M5 |
| Differential | our proofs/verification vs the reference Python `ots` client on a shared corpus | CI job (Python, dev-only) |
| Negative | every SR-10 case | Vitest |
| End-to-end | stamp → download → verify in real Chromium/Firefox; offline mode; CSP violation reporter fails the test on any violation | Playwright |
| Reproducibility | build twice, compare hashes | CI |
| Accessibility | axe-core scan + manual keyboard/screen-reader pass | Playwright + manual |

**Definition of done for any feature:** requirement ID referenced, positive and negative tests, docs updated, no new dependency without ADR, CI green.

---

## 13. Release and distribution

- Artefacts: `unaltered-<version>.zip` (multi-file), `unaltered-<version>.html` (single-file), `SHA256SUMS`, `SHA256SUMS.sig`.
- Signing: dedicated release key (see `OPSEC.md`); public key published in the repo and at least two independent places.
- Hosting targets: GitHub Pages or any static host, plus an IPFS pin; document that users should compare hashes rather than trusting a host.
- Anti-phishing: the app shows its own version and build hash in the footer so users can compare to the published value; docs warn about clone sites.

---

## 14. Open questions (decide by the milestone shown)

| # | Question | Decide by |
|---|---|---|
| Q1 | Official JS OTS package vs minimal in-house codec (ADR-003) | M0 |
| Q2 | Do calendars and explorers allow browser CORS? Which pairs give ≥2 independent sources? | M0 |
| Q3 | Keep or drop ICC profiles on JPEG? Default drop is safest; may shift colours | M3 |
| Q4 | Handle EXIF Orientation: warn only (v0.1) or lossy re-encode path | M3 |
| Q5 | Domain name: none (IPFS/ENS only) vs a registered domain (adds identity trail and a takedown point) | M5 |
| Q6 | Which independent auditor and when (see BUILD_PLAN M5) | M4 |
| Q7 | Trusted Types browser support and enforcement in Tor Browser | M2 |

---

## 15. Implementation notes (v0.1 build, 2026-10-14)

Where the code is stricter than, or fills a gap in, this document. See `docs/AUDIT.md` for evidence.

- **Q1** decided: in-house codec (ADR-003). **Q3** decided: ICC and all other APPn dropped. **Q4** decided: warn only; the cleaned-image result carries `orientation`. **Q7** answered for Chromium only (ADR-010).
- **JPEG (8.1):** arithmetic-coded and hierarchical JPEGs (SOF9-11, 13-15, DAC, DHP, EXP) and JPEGs with a zero frame height (DNL) are `unsupported` rather than silently stripped, because dropping DAC/DNL changes decoding. The JFIF APP0 is rewritten as a canonical 16-byte header with the embedded thumbnail removed. `StripOutcome.cleaned` has an extra optional `orientation` field.
- **PNG (8.2):** also requires IHDR first, contiguous IDAT, valid PLTE/tRNS/sRGB placement, and rejects unknown *critical* chunks.
- **Verification (FR-7):** the app fetches the raw 80-byte header and checks it hashes to the block hash the explorer claimed, then reads the Merkle root and time from the bytes itself. Sources are counted by distinct host. Several Bitcoin attestations: the earliest verified one is reported; any `VERIFIED` beats other outcomes.
- **FR-13:** settings select among built-in endpoints (ADR-008).
- **FR-10:** the reference client's `make_merkle_tree` / `cat_sha256` construction, one nonce per file.
- **SR-1:** CSP adds `trusted-types unaltered-worker`; generated by `scripts/build.mjs` from `core/net/allowlist.ts`.
- `VerifyReport` has an extra optional `pendingCalendars`; `UpgradeResult` lists calendars that were skipped.

