# Dependencies and Components

Goal: **as few as possible**, and only audited or independently verifiable ones.
"Audited" is not "certified": no JavaScript library we found has a formal certification (e.g., FIPS validation of the shipped JS). What exists is independent audit reports of varying age and scope. Verify scope before relying on it.

Historical research tables below were reviewed on 2026-10-09, with adoption records dated separately. Current audit-preparation review: 2026-10-30; see the new snapshot before the historical REL-1 record. The dated snapshot supersedes planning statuses such as “candidate pin” and “decision pending” without rewriting the historical research or claiming that its external sources were rechecked.

## Integration snapshot — 2026-11-04 (minimatch advisory decision)

Lockfile unchanged: SHA-256 `836f4e61ef6339339bbbf6f07692a31dadd141cbe3755ef5610f7980dff262df` (same as 2026-10-30).
Node 22.23.4 / npm 10.9.9: `npm audit --omit=dev` reports 0. Full `npm audit` still reports the same 11 moderate dev-only
entries, all from `minimatch@10.2.6` ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), CWE-405,
fixed in `>=11.0.1`).

Upstream check, from npm registry metadata on 2026-11-04:

- `eslint@10.14.0` (latest) declares `minimatch ^10.2.6`.
- `@eslint/config-array@0.23.5` (latest) declares `^10.2.4`.
- `@typescript-eslint/typescript-estree@8.72.1` (latest) declares `^10.2.2`.

No upstream release of the lint chain accepts a fixed version yet. `minimatch@11.0.4` also adds a new transitive
package (`@isaacs/nonrecursive-glob-match`, BlueOak-1.0.0).

**Decision: accepted risk; no override applied.** An `overrides` entry forcing `minimatch@11` would violate the declared
semver ranges of three packages and add an unreviewed transitive dependency. The fix it would buy is small:

- The advisory needs attacker-controlled glob patterns.
- In this repository, glob patterns reach minimatch only from repository-controlled ESLint configuration and command lines.
- No product, CLI or build code path uses minimatch. Shipped artifacts contain none of the lint chain.

Revisit when ESLint or typescript-eslint publish a release whose declared range includes `>=11.0.1`. Then do a normal
exact-pin bump, a lockfile diff review, `npm ci --ignore-scripts` and `npm run check`.

`npm audit signatures` is still blocked in this executor ("Failed to download" fetching TUF metadata). No local
provenance claim is made; the native CI `build-test` job remains the signature evidence.

## Audit-preparation snapshot — 2026-10-30

Candidate based on main `da9b0a3626e702381f2ad1d1b1d4cd3128fde2dd`; the consolidation changes no dependency or lockfile pin.
Current lockfile SHA-256: `836f4e61ef6339339bbbf6f07692a31dadd141cbe3755ef5610f7980dff262df`.
Runtime remains `@noble/hashes@2.4.0`; current exact dev pins: `@axe-core/playwright@4.14.0`, `@eslint/js@10.0.1`, `@playwright/test@1.64.1`, `@types/node@26.6.5`, `esbuild@0.28.2`, `eslint@10.13.0`, `fast-check@4.10.2`, `typescript@6.0.3`, `typescript-eslint@8.72.0`, `vitest@5.0.5`.

Fresh Node22.22.0/npm10.9.4 `npm ci --ignore-scripts` passed (139 packages). `npm audit --omit=dev` reports zero vulnerabilities.
Full `npm audit` reports 11 moderate entries propagated from dev-only `minimatch@10.2.6`, advisory
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (globparts amplification denial of service;
reported affected range below11.0.1). ESLint/typescript-eslint chains are affected; shipped runtime code is not.
This remains open: a maintainer/dependency reviewer should evaluate a compatible fixed transitive tree, review its diff,
then repeat the locked install, checks and provenance. No blanket `npm audit fix` or suggested destructive downgrade was applied.
The current lint globs are repository-controlled, which narrows exposure but does not close the advisory.

`npm audit signatures` is blocked here by HTTP403 obtaining TUF metadata from `tuf-repo-cdn.sigstore.dev`; no successful
local provenance check is claimed for this candidate. Native source run41171752457 verifies139 registry signatures and58 attestations. Five current official Action tag-to-full-SHA mappings were freshly
verified; this is pin identity evidence, not an audit of action behavior. See `CONSOLIDATION_20261030.md` for exact
candidate checks and native CI status. Older dated evidence below remains historical.

## Historical internal snapshot — 2026-10-24

Source: `1453865ca21a5c8a98b92805a36799de44d97919` (PR #6). `package.json` and `package-lock.json` are unchanged from the resume baseline `e4d80b67d145e940b0458bad93cc069412b39306`. Lockfile format: 3; SHA-256: `cd4546fa88716387db8fe8920777c9dc992f0c9efb343d311a3f0057028f287f`.

- Runtime: `@noble/hashes` **2.4.0**, exact manifest/lockfile agreement, no package runtime dependencies; production code imports the `sha2.js` subpath. No claim is made that this version is covered by the historical v1.0.0 independent audit or that the outstanding audited-version comparison has been completed.
- OpenTimestamps: the in-house codec is the implemented choice (ADR-003); the npm client/forks remain outside the dependency set. Python `opentimestamps==0.4.5` remains a dev/CI reference only.
- Dev-only direct pins: `@axe-core/playwright@4.13.0`, `@eslint/js@10.0.1`, `@playwright/test@1.64.0`, `@types/node@26.6.5`, `esbuild@0.28.2`, `eslint@10.12.0`, `fast-check@4.10.2`, `typescript@6.0.3`, `typescript-eslint@8.71.2`, `vitest@5.0.4`. Installs retain `npm ci --ignore-scripts`; no package or lockfile update was made by this review.
- Current CI evidence supplied by the integrating worker: [run 40105518156](https://github.com/djshellshoxxx/Unaltered/actions/runs/40105518156) passed package-signature verification (141 signatures, 59 attestations), Linux/Windows/macOS builds/tests and checksum identity, and 19 app tests in each of Chromium, Firefox and WebKit. Signature/provenance checks authenticate the package evidence checked; they do not prove benign behavior or an independent security audit. The native 2 GiB browser-memory job was still pending when this record was written.

This refresh inspects local manifests, lockfile, imports and controls; it performs no new upstream research, vulnerability advisory scan, independent audit or complete source comparison of dependencies. Historical unverified research items remain unverified unless a later dated record explicitly resolves them. See [review scope and remaining controls](REVIEW_REFRESH_20261024.md).


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
| Block explorers (`mempool.space`, `blockstream.info`) | L1 verification | API shape from Esplora docs; **live CORS unverified** (M0-3, see `docs/NETWORK.md`) |

## 6. Explicitly rejected

- Any CDN-hosted script, font, or analytics.
- Web frameworks (React/Vue/etc.): large transitive trees, build complexity, and larger attack surface for a three-screen app. Vanilla TypeScript + small view helpers.
- `bitcoinjs-lib`/`bitcore` and other large Bitcoin libraries: we only need to compare a 32-byte Merkle root with a block header value; do not take on a wallet library.
- Anything that needs install scripts.

## 7. Dependency review record (fill in at each change)

| Date | Package | Version | Reviewer | Diff reviewed against | Notes |
|---|---|---|---|---|---|
| 2026-10-14 | @noble/hashes | 2.4.0 | build session | package README / npm metadata (`npm audit signatures` runs in CI) | Only `sha2.js` is imported. Zero runtime dependencies. Not yet compared against a previously reviewed version: first adoption |
| 2026-10-14 | typescript, esbuild, vitest, fast-check, eslint, @eslint/js, typescript-eslint, @types/node, @playwright/test, @axe-core/playwright | exact versions in package.json | build session | lockfile diff on first install | Dev only, not shipped. `npm ci --ignore-scripts` verified: esbuild works via its platform package without a postinstall |
| 2026-10-14 | opentimestamps (PyPI, python) | 0.4.5 | build session | sdist read for protocol constants | Dev/CI only: fixture generation and differential tests |
| 2026-10-22 | Gitleaks | 8.30.1 | development validation | official GitHub release asset digest checked before extraction | Dev/CI only. Linux artifact SHA-256 `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`; local full-history scan passed. No PR comments or third-party reporting configured |
| 2026-10-24 | Current direct dependencies and lockfile | exact versions in current snapshot above | internal resume review | local manifest/lockfile agreement; no diff from resume baseline | REL-1 record refresh only. No dependencies changed; current CI signature/provenance results recorded above. No new upstream audit/advisory research or independently audited-version diff claimed |
| 2026-11-04 | minimatch (transitive, dev-only via eslint/typescript-eslint) | 10.2.6 | integration session | npm registry metadata of eslint 10.14.0, @eslint/config-array 0.23.5, typescript-estree 8.72.1, minimatch 11.0.4 | GHSA-g3hv-75wg-m249 accepted as dev-only risk (repository-controlled patterns); no override, lockfile unchanged. See 2026-11-04 snapshot |
| 2026-11-04 | opentimestamps, python-bitcoinlib, pycryptodomex (PyPI, python) | 0.4.5, 0.12.2, 3.23.0: version and wheel SHA-256 pins in `tests/differential/requirements.txt` | integration session | PyPI JSON metadata: declared dependencies, upload dates, published SHA-256 of each listed wheel. `pip --require-hashes` re-hashed the Linux x86_64 wheels on install (Python 3.12 and 3.13); the other platforms' hashes are as PyPI publishes them | Dev/CI only: differential job and `scripts/r1-acceptance.sh`, installed with `--require-hashes --only-binary :all:`. Before this, `pip install opentimestamps==0.4.5` resolved the newest pycryptodomex (`>=3.3.1`) and python-bitcoinlib (`>=0.9.0,<0.13.0`) on every run, with no hash. The 2026-10-14 row records no hash. python-bitcoinlib 0.12.2 is the newest version the range allows. pycryptodomex 3.23.0 (2025-05-17) was chosen over 3.24.x (October 2026) as the longest-aged release. No code review of the wheels is claimed. Pip is not covered by Dependabot, so a bump is a manual edit plus a new row here |

## Fuzz-runner Git prerequisite — 2026-11-05

The development fuzz runner invokes Git by an absolute system path: `/usr/bin/git` or
`/bin/git` on Linux/macOS; `C:/Program Files/Git/cmd/git.exe` or the corresponding
`Program Files (x86)` location on Windows. These administrator-managed locations must
contain the trusted Git installation. A nonstandard installation fails with an explicit
prerequisite error; the runner never falls back to inherited `PATH` or the current
working directory. This changes development tooling only; no Git binary is bundled.

The exact PR47 Sonar finding was retrieved from the public issues API: `javascript:S4036`,
`scripts/parser-fuzz.mjs:29`, unsafe executable search. Before the fix, executed regression
tests demonstrated that a writable directory at the front of `PATH` could supply a fake
Git binary, and an empty `PATH` stopped source-evidence collection. Both cases and the
four existing campaign tests pass after the fix. This closes the reproduced behavior;
a passing new Sonar analysis is a separate external gate.

Sources: [Node child-process command lookup](https://nodejs.org/api/child_process.html),
[Sonar's S4036 introduction](https://community.sonarsource.com/t/many-improvements-for-js-ts-css-and-two-new-rules-for-security-and-tests/64617).
No third-party source code was copied and no dependency changed.
