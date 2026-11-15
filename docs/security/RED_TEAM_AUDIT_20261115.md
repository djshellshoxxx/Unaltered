# Red-Team Security Audit — 2026-11-15

**Target:** `djshellshoxxx/Unaltered`  
**Reviewed ref:** `main` (files fetched during this review; see per-file blob SHAs below)  
**Audit branch:** `security/red-team-audit-20261115`  
**Scope:** read-only source and workflow review. This document records findings only; no application code, workflow, release, secret, branch-protection, or repository setting was changed.

## Executive summary

This pass concentrated on attacker-controlled inputs, trust boundaries, credential handling, the QR image pipeline, OpenTimestamps verification, and the API-funded cloud development workflow.

The strongest new finding is in the bundled project-generation toolkit: `shared/scripts/create_project.py` copies a starter tree with `shutil.copytree` using the default `symlinks=False`. That follows links in the starter tree and can copy data from outside the starter directory into a generated project. The script then initializes Git with `git add .` and can optionally create and push a public repository. This is a conditional local data-exposure vulnerability when the starter tree is untrusted or compromised.

A second confirmed weakness is handling of the Apple app-specific password: it is accepted as a command-line argument and written to `.env` without explicitly setting restrictive permissions. The current starter template's `.gitignore` does ignore `.env`, so this audit does **not** claim that the password is automatically committed by the normal path. The remaining risks are process-argument exposure and local file readability.

The cloud coding workflow also has a policy/enforcement mismatch: its prompt says not to change trust and host policies, but the changed-path guard permits all files under `src/` and `scripts/`. The workflow creates a PR rather than directly merging, which limits impact but does not replace an enforced protected-path list.

No direct remote exploit against the browser application was established in this source-only pass. Its bounded parsing, local hashing, network allowlist, redirect refusal, CSP/Trusted Types, and independent explorer agreement remain meaningful defenses. They do not establish Bitcoin consensus validation or protect against every local resource-exhaustion scenario.

## Findings

### RT-01 — Starter-tree symlinks can copy files from outside the trusted source tree

**Severity:** High (conditional on an attacker-controlled or compromised starter tree)  
**Confidence:** High — directly visible in implementation; exploit not executed.

**Affected code:** `shared/scripts/create_project.py`, functions `copytree`, `init_git`, `maybe_create_github`.

**Evidence:**
- `copytree(src, dest)` calls `shutil.copytree(src, dest, ignore=ignore)` without `symlinks=True` and without validating link targets.
- Python's default `shutil.copytree` behavior follows symbolic links rather than preserving them as links.
- The copied destination is then processed as a project tree.
- Unless `--no-init-git` is supplied, `init_git` runs `git add .` and commits the generated project.
- With `--create-github`, the script can push the result; `--public` explicitly selects a public repository.

**Attack path:**
1. An attacker can influence the selected starter directory (for example, a compromised local starter checkout).
2. The starter contains a symlink whose target is outside the starter root, such as a local credential or private configuration file.
3. `copytree` dereferences the link and copies its contents into the destination.
4. The generated file may be staged by `git add .` if its destination path is not ignored.
5. If the user creates/pushes a public repository, copied local data may be disclosed.

This is not an unconditional remote exploit: it requires the starter tree to contain a malicious link and the user to run the generator. The exact impact depends on the selected target and destination path. A symlink named `.env` may be ignored by the starter's Git ignore rules; other filenames may not be.

**Remediation:**
- Reject all symlinks in the starter tree by default, including directory symlinks.
- If symlinks must be supported, resolve every target and require it to remain beneath the resolved starter root; reject broken links and path races.
- Prefer copying from a verified, pinned starter commit rather than an arbitrary local tree.
- Before Git initialization, scan the destination for symlinks, unexpected files, credential-like content, and files outside an explicit template manifest.
- Add regression tests for file and directory symlinks pointing outside the source tree, including targets named like SSH keys, cloud credentials, and application configuration.
- Require a clear confirmation before public publication and show the staged file list first.

### RT-02 — Apple app-specific password is exposed through process arguments and a broadly permissioned config file

**Severity:** Medium  
**Confidence:** High — directly visible in implementation. File mode depends on the process umask.

**Affected code:** `shared/scripts/create_project.py`, argument parsing and `write_env`.

**Evidence:**
- The parser accepts `--app-specific-password`.
- The value is copied into `APP_SPECIFIC_PASSWORD` and written to `.env`.
- `write_env` uses `Path.write_text` without explicitly setting file mode or applying `chmod(0600)`.
- On common Unix systems with a typical `022` umask, a newly created file is commonly mode `0644`; the script does not enforce owner-only access.
- The current upstream starter `.gitignore` includes `.env`. Therefore the normal `git add .` path should ignore this file; this audit does not classify automatic Git publication of `.env` as confirmed.

**Attack path:**
- A local user/process with sufficient process-inspection access may read the password from the command line while the script runs.
- Other local accounts may be able to read the generated `.env` if the resulting mode is world-readable.
- The credential persists after project generation until the user removes it or rotates it.

**Remediation:**
- Do not accept passwords through command-line arguments. Read interactively without echo or use a supported OS credential store.
- Avoid persisting app-specific passwords in generated project configuration. Prefer short-lived credentials injected only into the notarization command.
- If persistence is unavoidable, create the file atomically with owner-only permissions (0600 on POSIX), verify the resulting mode, and fail closed if it cannot be secured.
- Keep `.env` ignored and add a pre-commit check that rejects secrets even in ignored/untracked files when a public push is requested.
- Document credential rotation after suspected exposure.

### RT-03 — Cloud coding workflow does not enforce its own security-sensitive path restrictions

**Severity:** Medium  
**Confidence:** High — prompt and guard are both present in the workflow.

**Affected code:** `.github/workflows/unaltered-codex-cloud.yml`.

**Evidence:**
- The Codex prompt says not to modify trust and host policies and excludes only a small set of named paths.
- The subsequent path guard accepts any changed path matching `src/*` or `scripts/*`.
- The guard does not explicitly reject security-sensitive files such as:
  - `src/core/net/allowlist.ts`
  - `src/core/net/fetch.ts`
  - `src/core/ots/verify.ts`
  - `src/core/ots/codec.ts`
  - `scripts/opsec-check.sh`
- The patch is packaged and a separate job opens a pull request from it.

**Impact:**
A coding-agent run can produce a PR that changes trust boundaries, network policy, proof parsing, verification, or OPSEC checks despite the prompt's instruction not to do so. The current PR-only design and human review reduce the likelihood of silent deployment, but the policy is not enforced at the path-validation layer.

**Remediation:**
- Maintain an explicit denylist of security-critical paths and reject them in the workflow guard.
- Consider a stronger allowlist of exact permitted files/directories per task rather than broad `src/*` and `scripts/*` globs.
- Validate renames, deletions, symlinks, and unusual path forms, not just ordinary modified filenames.
- Require a security-owner review for any PR touching network policy, proof parsing, hashing, verification, CSP/build policy, release workflows, or OPSEC scripts.
- Add workflow tests proving that changes to every protected path fail the guard.

### RT-04 — QR image processing can create substantial peak memory pressure at the accepted maximum size

**Severity:** Low / availability hardening  
**Confidence:** Medium — inferred from allocation paths; no memory-exhaustion test was run.

**Affected code:** `src/core/archive/qr-image.ts`, `src/core/archive/qr-scan.ts`, `src/core/archive/qr-decode.ts`, `src/core/archive/qr-limits.ts`.

**Evidence:**
- The image limit is 16,000,000 pixels and the maximum side is 6,000 pixels.
- `scanQrImage` reads the encoded file into a byte array, creates a Blob for `createImageBitmap`, allocates a canvas, and obtains a full RGBA `ImageData` buffer.
- `scanQrPixels` transfers the pixel buffer to a worker.
- `decodeRasterFrames` copies the pixel array with `data.slice()` before scanning candidate regions and retry scales.
- The scan timeout is 120 seconds and the worker is terminated on timeout/abort.

At the 16-megapixel limit, a single RGBA buffer is approximately 64 MB before browser decoder, canvas, copies, and temporary downscaled buffers are counted. Peak memory can therefore be several times the nominal pixel buffer. The hard limits and worker timeout are good controls, but the configured maximum may still be too high for memory-constrained devices.

**Remediation:**
- Measure peak resident memory and runtime on low-memory mobile browsers using worst-case 16 MP inputs.
- Consider lowering the default pixel limit or adding a device-appropriate limit.
- Avoid redundant full-frame copies where possible; transfer ownership and reuse bounded buffers.
- Ensure candidate-region extraction does not repeatedly allocate large cropped images.
- Add stress tests for maximum dimensions, dense multi-symbol images, cancellation, and worker termination.

This is a resource-exhaustion hardening concern, not evidence of remote code execution or a demonstrated browser crash.

## Reassessed controls and non-findings

The following controls were inspected and appeared sound in the reviewed source:

- `src/core/net/fetch.ts`: validates HTTPS URLs, rejects credentials and non-allowlisted hosts, refuses redirects, omits credentials/referrers, applies timeouts and response-byte limits.
- `src/core/net/allowlist.ts`: defines a small explicit endpoint set; explorer and calendar roles are separated.
- `src/core/ots/codec.ts`: applies input, node, depth, operation-argument, URI and attestation limits; uses iterative tree parsing and rejects unsupported tags.
- `src/core/ots/bitcoin.ts`: validates the 80-byte header length, hashes the raw header, checks the explorer-claimed block hash, deduplicates source identities, and requires at least two agreeing sources.
- `src/core/ots/verify.ts`: reserializes and reparses in-memory proofs before verification and checks the replayed commitment against the header Merkle root.
- `src/core/archive/qr-scan.ts`: bounds image bytes/dimensions, validates worker messages, applies a timeout, and terminates the worker on completion/abort.
- `scripts/build.mjs`: derives CSP network hosts from the allowlist and embeds workers under CSP/Trusted Types controls.
- `.github/workflows/ci.yml` and `.github/workflows/release.yml`: use least-privilege defaults, pinned action SHAs, disabled dependency install scripts, cross-platform artifact comparison, and checksum verification.

**Important limitation:** Bitcoin verification remains explorer-header quorum, not independent Bitcoin consensus validation. The code verifies the header hash and Merkle-root commitment but does not establish proof-of-work, chain membership, or cumulative chainwork using a locally trusted full node. This is an architectural assurance limitation, not a newly discovered bypass.

## Corrections to the prior audit

- The current `package.json` on `main` declares two runtime dependencies: `@noble/hashes@2.4.0` and `jsqr@1.4.0`. Earlier wording that referred to one runtime dependency is outdated.
- The prior minimatch advisory was not independently revalidated against the current lockfile/advisory database in this pass. Treat it as an item requiring a fresh `npm audit`/advisory check, not as a confirmed current vulnerability.
- The starter repository's current `.gitignore` includes `.env`. The password-file finding is about command-line and local filesystem exposure; automatic staging of that specific file is not claimed.

## Validation status and limits

- Source review: completed for the paths listed above.
- GitHub workflow review: completed for the cloud development, CI, and release workflows fetched in this pass.
- Dynamic exploit reproduction: not performed.
- Full test suite, typecheck, lint, browser E2E, parser fuzzing, and memory profiling: not run in this review.
- Repository settings, branch protection, secret values, runner isolation, and actual Actions execution environment: not independently inspected.
- No credentials were requested, read, or tested.
- No production exploit or proof-of-concept was executed.

## File evidence (reviewed blob SHAs)

| File | Blob SHA |
|---|---|
| `shared/scripts/create_project.py` | `6cd790f55707775774a091040745344e57d433b4` |
| `src/core/net/fetch.ts` | `dbda02e000aa857b9626988867030ff993249fd6` |
| `src/core/net/allowlist.ts` | `ab15540c571405e7dbc3b461172ff9a919fde94d` |
| `src/core/ots/verify.ts` | `758a4a50f4385765193c8e51e016d74d89d9cec4` |
| `src/core/ots/codec.ts` | `96c967191058838061a73c4ab56fe58f6ec32259` |
| `src/core/ots/bitcoin.ts` | `669ba34818b9b3c3f7f5a200a16f7dc54d767577` |
| `src/core/archive/qr-scan.ts` | `b3a12061e6425bb1e66fb3200e0327d55079747e` |
| `src/core/archive/qr-decode.ts` | `6bd8fad1e150bc73b72470ba908a2170dcd1b58e` |
| `src/core/archive/qr-image.ts` | `3b1d4dbd9429e7d32eaf8123ec3c9b1cc507b33c` |
| `src/core/archive/qr-limits.ts` | `a5726ccd6dae28220fdfd597b839d6065a656297` |
| `.github/workflows/unaltered-codex-cloud.yml` | `2d7fac7582c61fae96844b52ad26a3f7e758b8b1` |
| `.github/workflows/ci.yml` | `0c9064be70971c3983cca7a17f94e81e0f7d899e` |
| `.github/workflows/release.yml` | `28ecd6b08719c8190400a65d8181137f22bf9330` |
| `package.json` | `c79cf3936d06a67a9a629a1a2f85603250a91119` |

---
**Disposition:** Findings documented for maintainer triage. No code fixes are included in this audit-notes commit.
