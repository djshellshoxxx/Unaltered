# Red-Team Security Audit — Sensitive Components Pass — 2026-11-15

**Repository:** `djshellshoxxx/Unaltered`  
**Source reviewed:** current `main`  
**Notes branch:** `security/red-team-audit-20261115`  
**Scope:** network policy, proof parsing and replay, Bitcoin verification trust, calendar upgrade, local file hashing, secret handling, and privileged GitHub Actions workflows.

## Executive summary

No new remote code-execution, proof-forgery, network-policy bypass, or secret-exfiltration vulnerability was confirmed in the source paths reviewed.

One additional **low-severity local availability issue** was identified: the Stamp view accepts an unbounded number of selected files and starts processing each immediately. Each hash can create its own worker. A user selecting a very large number of files can cause excessive worker creation, memory pressure, and browser unresponsiveness.

The previously reported starter symlink, credential handling, and cloud-workflow path-guard findings remain open. The cloud workflow was examined more closely in this pass because it has access to a repository API key and a separate PR-publishing job.

## Findings

### RT-05 — Unbounded concurrent file hashing in Stamp view

**Severity:** Low — local availability  
**Confidence:** High  
**Files:**
- `src/ui/views/stamp.ts`
- `src/core/hash/hasher.ts`
- `src/core/ots/calendar.ts`

**Evidence:**
- The Stamp view's `add(files)` loops over every selected file, adds an item, and immediately calls `void process(it)` without a file-count limit or queue.
- `process(it)` calls `hashBlob()`.
- `hashBlob()` attempts to create a dedicated Web Worker for each hash.
- `createReceipt()` later maps every item digest into `stampBatch()`; the core batch function has no maximum digest-count check.

**Impact:** A user selecting a very large number of small files can cause a large number of concurrent workers, file-processing tasks, and retained UI objects. This can exhaust browser resources or make the tab unresponsive. The trigger requires the user to select/drop the files; this is not a remote website attack and does not expose other users' data.

**Recommendation:**
1. Set a documented maximum number of files per batch at the UI boundary.
2. Queue hashing with a small fixed concurrency (for example, 2–4 workers) rather than starting one worker per file.
3. Enforce a corresponding maximum digest count inside `stampBatch()`, so non-UI callers cannot bypass the limit.
4. Add tests for the maximum accepted count, rejection above the limit, cancellation while queued, and cleanup of workers after removal/cancellation.

No stress test was run, so the exact file count at which a particular browser becomes unstable is not claimed.

## Sensitive trust-boundary review

### 1. Network allowlist and transport — no new finding

**Files:** `src/core/net/allowlist.ts`, `src/core/net/fetch.ts`

- Production endpoints are enumerated by exact host.
- URL validation requires HTTPS, rejects URL credentials and non-default ports, and checks the parsed host against the allowlist.
- Redirects are rejected; credentials and referrers are omitted; cache is disabled.
- Responses are capped by declared and streamed byte counts.
- Timeouts and caller cancellation are combined.
- The insecure HTTP and custom-fetch hooks are explicitly marked as test seams.

**Assessment:** No host-allowlist bypass was identified in the reviewed production call paths. Keep the test-only policy overrides inaccessible to production settings and UI input.

### 2. OpenTimestamps parser and proof replay — no new finding

**Files:** `src/core/ots/codec.ts`, `src/core/ots/ops.ts`, `src/core/ots/verify.ts`

- Input, node, depth, operation argument, message, attestation, and distinct Bitcoin-attestation limits are enforced.
- Parsing is iterative and rejects unknown/unsupported operation and attestation types.
- Pending calendar URIs are restricted to an inert character set and later must pass the configured calendar allowlist before network access.
- Verification reserializes and reparses in-memory proof objects before replay.
- A matching file digest and replayed commitment-to-Merkle-root comparison are required before the UI reports `VERIFIED`.

**Assessment:** No proof-tree mutation, parser-limit bypass, or pending-attestation promotion path was established in this pass.

### 3. Bitcoin header verification — trust-model limitation reconfirmed

**Files:** `src/core/ots/bitcoin.ts`, `src/core/ots/verify.ts`, `src/core/ots/trusted-header.ts`

- Explorer responses are checked for valid hex lengths.
- The raw 80-byte header is hashed locally and must match the block hash claimed by that explorer.
- The header Merkle root is extracted locally and compared with the replayed receipt commitment.
- Quorum counts distinct source IDs and requires at least two sources.
- The offline trusted-header path clearly labels the evidence as user-supplied and explicitly says it does not check chain membership or Bitcoin consensus.

**Important limitation (not a newly discovered bug):** Agreement between two explorers, even when their raw headers hash correctly, is not equivalent to independently validating proof of work, difficulty, cumulative chainwork, or best-chain membership. The product's own trust language and local-node guidance should continue to make this distinction clear. A full-node-backed verification mode would provide stronger independent assurance.

### 4. Calendar stamping and upgrade — no new finding

**File:** `src/core/ots/calendar.ts`

- Calendar identities are deduplicated by host when stamping.
- Upgrade requests are made only for pending attestations whose normalized base URL is in the selected calendar list; the transport independently enforces the global host allowlist.
- A 404 is treated as “not yet confirmed,” not as a successful Bitcoin attestation.
- Calendar responses are parsed under the same proof limits and merged transactionally; serialization validates the complete resulting proof before it is returned.
- The optional liveness canary is a fixed public commitment and is not merged into the user's receipt or used to change its status.

**Assessment:** No pending-to-confirmed shortcut or arbitrary-host request was found.

### 5. Secret handling and project generator — prior findings reconfirmed

**Files:** `shared/scripts/create_project.py`, `scripts/opsec-check.sh`

- The generator still accepts the Apple app-specific password as a command-line argument and writes it to `.env` without explicitly setting restrictive file permissions. This remains RT-02.
- The generator still uses `shutil.copytree` with default symlink dereferencing. This remains RT-01.
- The OPSEC script is a repository hygiene check; it does not make a runtime secret safe after it has been placed in process arguments or an overly permissive local file.

No credentials were read or tested.

### 6. Privileged cloud coding workflow — prior path-guard concern reconfirmed

**File:** `.github/workflows/unaltered-codex-cloud.yml`

- The development job receives an API key and runs the coding agent with workspace access.
- The prompt says trust and host policies are out of scope, but the enforced path guard broadly permits `src/*` and `scripts/*`. That includes network policy, proof verification, and OPSEC-sensitive files.
- The publish job applies the generated patch and opens a PR. It has write permissions for contents, pull requests, and Actions so it can publish the checkpoint and dispatch CI.
- The workflow does not automatically merge or release the generated patch.

**Assessment:** This confirms RT-03. The prompt is not an enforceable security boundary. Replace the broad directory allowlist with a narrow positive allowlist and explicit protected-path denylist; require a security-owner review for any change touching network, proof, cryptographic, build, or OPSEC controls. Keep the PR-only publication model.

## Prior findings still open

- **RT-01 — High, conditional:** starter-tree symlink dereferencing can copy files outside the starter tree.
- **RT-02 — Medium:** app-specific password can appear in process arguments and is written to `.env` without explicit restrictive permissions.
- **RT-03 — Medium:** cloud coding workflow's actual path guard is broader than its stated security exclusions.
- **RT-04 — Low availability hardening:** QR image processing can have high peak memory use.
- **RT-05 — Low availability:** unbounded concurrent hashing for a user-selected multi-file batch (new in this pass).

See the earlier audit notes for the full evidence and recommendations for RT-01 through RT-04.

## Validation limits

- Source inspection only; files were fetched from `main`.
- No application code or workflow was changed.
- No tests, fuzzing, dynamic exploit reproduction, browser stress test, or live service interaction was run.
- No repository settings, branch protection rules, Actions secret values, or signing credentials were inspected.
- No claim is made that the repository is vulnerability-free.

**Disposition:** Sensitive-components audit notes for maintainer triage. No fixes included.
