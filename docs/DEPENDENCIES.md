# Dependencies and Components

Goal: **as few as possible**, and only audited or independently verifiable ones.
"Audited" is not "certified": no JavaScript library we found has a formal certification (e.g., FIPS validation of the shipped JS). What exists is independent audit reports of varying age and scope. Verify scope before relying on it.

Last reviewed: 2026-10-09 (research session). Update this table at every dependency change.

## 1. Runtime dependencies

| Component | Role | Status | Evidence (verified from README / reports) | Caveats |
|---|---|---|---|---|
| **`@noble/hashes`** (sha2 only) | Streaming SHA-256 for large files | **Approved (candidate pin at M1)** | README: 0 dependencies; independently audited by Cure53 at v1.0.0, Jan 2022; audit scope "everything besides blake3, sha3-addons, sha1 and argon2", so SHA-256 is covered; signed commits; releases via token-less CI and Trusted Publishing; `sha256.create().update(a).update(b).digest()` supports partial updates | Audit is of v1.0.0; later versions are covered only by the project's own review and "AI-assisted self-audits" since Apr 2026 (README wording), which are **not** independent audits. Pin an exact version, diff against audited v1.0.0 behaviour, import only `sha2` subpath to keep bundle minimal |
| **WebCrypto `crypto.subtle.digest`** | Cross-check SHA-256 (files ≤ 64 MiB); `crypto.getRandomValues` for nonce | **Approved** (browser built-in) | Native to every supported browser | `digest` is one-shot (not streaming), hence noble for big files |

## 2. OpenTimestamps components (decision pending, ADR-003)

| Component | Use | Status | Findings |
|---|---|---|---|
| **Official `opentimestamps` JS package** (`opentimestamps/javascript-opentimestamps`) | Possible codec/stamp/verify | **Do not adopt without M0 evaluation** | README says it is based on the Python implementation; CI tested against **Node 6.0, 6.1, 7**; build via `npm install --dev` and gulp (dated tooling); verification may use block explorers, and the README says that is "not as secure as asking a local node". I found **no published security audit**. Search results show it last pushed 2023-03 with open issues. Treat as a **reference**, not a trusted dependency |
| **`python-opentimestamps` + `opentimestamps-client`** | Reference implementation; dev-only differential testing and L2 verification instructions | **Approved for dev/CI only** | Established reference; README separates "consensus-critical `opentimestamps.core.*`" from other modules. No spec file or test vectors found in the repo listing, so the protocol must be learned from the code. No audit found |
| **In-house minimal codec** | Parse/serialise `.ots`; stamp/upgrade/verify against calendars | **Likely choice** if (a) is not viable | ~500-800 lines estimated; must be differential- and fuzz-tested against the reference client. Fewer dependencies and smaller attack surface, but we then own parser bugs |
| Third-party npm forks (`@alexalves87/opentimestamps`, `@otskit/*`, etc.) | n/a | **Not approved** | Self-reported claims ("zero-dependency", "fail-closed"), no independent audit found; small maintainer base |

Unverified item: the IETF draft `draft-fassbender-scitt-time-anchor` states a Bitcoin attestation tag value (`0x0588960d73d71901`). **Do not copy constants from secondary sources.** Obtain them from the reference implementation in M0-1 and cite the file/line in the code.

## 3. Image metadata stripping

| Option | Verdict |
|---|---|
| **Own allowlist rewriters** (`strip/jpeg.ts`, `strip/png.ts`) | **Chosen.** Small, auditable, fuzzable. Allowlist semantics are easier to reason about than any library's blocklist |
| EXIF libraries (`exifr`, `piexifjs`, etc.) | Mostly **readers/editors** that remove known tags; blocklist approach can miss fields (the CJR guidance warns standard tools "may not hit all the relevant exif fields"). Not approved |
| Canvas re-encode | Strips metadata by re-rendering pixels but is **lossy** for JPEG and changes the bytes; possible later fallback for high-stakes users (Q4) |
| Server-side tools (ExifTool etc.) | Rejected: needs a backend, violates NFR-1 |

## 4. Dev and build tooling (not shipped)

Pin exact versions at M0-1 via `npm install --save-exact --save-dev <pkg>`; review each in the lockfile diff. Choices:

| Tool | Why | Notes |
|---|---|---|
| TypeScript | Type safety, strict config provided | |
| esbuild | Fast, deterministic bundling for reproducible builds | Single Go binary; installed via npm optional platform packages: confirm integrity hashes in lockfile |
| Vitest | Unit tests | |
| fast-check | Property tests and mutation fuzzing | |
| Playwright | E2E in real Chromium/Firefox; CSP violation capture; axe-core scan | Uses the preinstalled browsers in managed environments; never auto-downloads in CI without pinning |
| ESLint (+ `eslint-plugin-security`, `no-unsanitized`) | Enforce SR-4 | |
| gitleaks | Secret scan (CI, binary action) | Pin by SHA |

## 5. Hosting and delivery components

| Component | Role | Notes |
|---|---|---|
| GitHub Pages / any static host | Primary delivery | Replaceable; documented in OPSEC |
| IPFS pinning | Censorship-resistant mirror | Pin per release; list CID |
| OpenTimestamps calendars | Stamp + upgrade | Third-party infrastructure; ≥2 required |
| Block explorers (`mempool.space`, `blockstream.info`) | L1 verification | **Unverified**: CORS and API shape (M0-3) |

## 6. Explicitly rejected

- Any CDN-hosted script, font, or analytics.
- Web frameworks (React/Vue/etc.): large transitive trees, build complexity, and larger attack surface for a three-screen app. Vanilla TypeScript + small view helpers.
- `bitcoinjs-lib`/`bitcore` and other large Bitcoin libraries: we only need to compare a 32-byte Merkle root with a block header value; do not take on a wallet library.
- Anything that needs install scripts.

## 7. Dependency review record (fill in at each change)

| Date | Package | Version | Reviewer | Diff reviewed against | Notes |
|---|---|---|---|---|---|
| | | | | | |
