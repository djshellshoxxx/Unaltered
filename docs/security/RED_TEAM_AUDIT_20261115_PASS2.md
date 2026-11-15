# Red-Team Security Audit — Second Pass — 2026-11-15

**Target:** `djshellshoxxx/Unaltered`  
**Reviewed ref:** `main`  
**Audit notes branch:** `security/red-team-audit-20261115`  
**Pass focus:** browser DOM and download sinks, local receipt storage, archival QR frame encoding/recovery, QR worker boundaries, PNG metadata rewriting, deterministic release archives, and JUCE helper scripts.

## Executive result

This second pass found **no additional confirmed exploitable vulnerability** in the reviewed paths beyond the findings already recorded in `RED_TEAM_AUDIT_20261115.md`.

The review specifically looked for:
- script-capable DOM sinks and unsafe URL attributes;
- unsafe persistence or trust of local browser storage;
- QR frame length/count inconsistencies and attacker-controlled allocation paths;
- archive entry path traversal or malformed archive metadata;
- unsafe subprocess invocation in helper scripts.

The controls below were directly visible in source. This was not a runtime penetration test and does not establish that every UI flow or generated artifact is safe.

## Reviewed controls and results

### 1. DOM construction and URL attributes — no finding

**Files:** `src/ui/dom.ts`, `src/ui/download.ts`

- Dynamic child strings are inserted as text nodes; no HTML-string insertion sink was found in the inspected DOM helper.
- The element helper blocks string-valued `on*` attributes and `srcdoc`, and ignores inline style attributes.
- URL-bearing attributes reject `javascript:`, `data:`, and `vbscript:` schemes after removing tab/newline/carriage-return characters and leading C0/space characters.
- Download filenames replace path separators, reserved filename characters, control characters, and bidi controls.
- Object URLs are tracked by owner and revoked when their view is disposed.

**Assessment:** No confirmed injection or URL-scheme bypass identified in these helpers. This does not replace review of every caller or browser-specific URL parsing tests.

### 2. Local receipt storage — no finding

**File:** `src/ui/store.ts`

- Persistence is opt-in.
- Stored records contain a digest, timestamp, and display label rather than original file bytes.
- Reads are guarded, parsed data is treated as untrusted, arrays are capped at 500 entries, digest strings must be 64 lowercase hex characters, and labels/timestamps are truncated.
- Disabling the feature removes stored data before removing the enabled flag.

**Assessment:** No sensitive receipt payload persistence or executable rendering path was identified in this module. Labels must continue to be rendered as text, not HTML.

### 3. Archival QR frame protocol — no finding

**File:** `src/core/archive/frames.ts`

- Receipt input is bounded to 16 MiB; frame count is bounded to 4,096; frame payload size is bounded to QR version 40-L capacity.
- The encoder snapshots the input before awaiting cryptographic operations.
- Recovery validates magic, version, reserved flags, compression mode, lengths, indices, consistent receipt metadata, duplicate conflicts, total payload length, and final SHA-256/proof identifier before returning reconstructed bytes.
- It checks the sum of present payload lengths before allocating the declared output buffer.

**Assessment:** No straightforward oversized-allocation, frame-mixup, or partial-frame acceptance bypass was found in this pass.

### 4. QR worker and decoder — no new finding

**Files:** `src/core/archive/qr-scan.worker.ts`, `src/core/archive/qr-decode.ts`

- The decoder validates image dimensions and pixel-buffer bounds before raster decoding.
- Candidate regions and symbol counts are capped.
- Retry work is bounded by a time budget and the caller's worker timeout; the caller terminates the worker on completion/abort.
- Decoded QR payloads are treated as bytes and are not executed as URLs or commands.

**Assessment:** The previously recorded peak-memory concern for large accepted images remains the main availability hardening item. No additional worker-message exploit was established.

### 5. PNG metadata cleaner — no finding

**File:** `src/core/strip/png.ts`

- The cleaner validates the PNG signature, chunk lengths, chunk names, CRCs, ordering and required structure.
- It uses an allowlist of retained chunks and does not decompress IDAT or allocate based on image dimensions.
- Metadata-removal summaries are bounded.

**Assessment:** No new parser bypass was identified in the reviewed implementation. This was source inspection, not differential fuzzing in this pass.

### 6. Deterministic ZIP/TAR writers — no current exploit path found

**File:** `scripts/lib/archive.mjs`

- The writer serializes caller-supplied entry names directly and does not itself reject absolute paths, parent-directory components, duplicate names, non-ASCII names, or ZIP size/count overflow.
- In the current build path inspected, the archive entries are assembled from fixed, repository-controlled filenames and a fixed package prefix; no user-controlled entry-name source was found.

**Assessment:** Not recorded as a vulnerability because the inspected production call path supplies fixed names. **Hardening recommendation:** validate archive entry names centrally (relative paths only; reject `..`, absolute paths, backslashes, control characters, duplicates and non-ASCII names) and reject ZIP64/field overflows rather than silently writing truncated fixed-width fields. Add tests before reusing these helpers with dynamic inputs.

### 7. JUCE helper subprocesses — no shell-injection finding in reviewed paths

**Files:** `shared/scripts/build_release.py`, `shared/scripts/inspect_juce_project.py`, `shared/scripts/port_audit.py`

- Reviewed subprocess calls pass argument arrays rather than concatenated shell command strings.
- Project paths are resolved before use.
- The inspected helper scripts do not evaluate project-provided strings as shell code.

**Assessment:** No shell-injection path identified in these files. Their file reads still operate on the selected local project tree; users should not run project-inspection tools against untrusted trees with elevated privileges.

## Prior findings remain open

This pass did not remediate or retest the earlier findings:

- **RT-01 — High, conditional:** starter-tree symlink dereferencing can copy files from outside the starter tree.
- **RT-02 — Medium:** app-specific password exposure through command-line arguments and potentially broad `.env` permissions.
- **RT-03 — Medium:** cloud coding workflow path guard does not enforce the prompt's security-sensitive path restrictions.
- **RT-04 — Low availability hardening:** large QR images can cause high peak memory use.

See `RED_TEAM_AUDIT_20261115.md` for evidence and remediation guidance.

## Validation limits

- This pass was source-only against files fetched from `main`.
- No application code or workflow was changed.
- No tests, browser automation, fuzz campaign, exploit reproduction, archive extraction test, memory profiling, or live service interaction was run.
- No credentials or secrets were accessed.
- No claim is made that the repository is vulnerability-free.

**Disposition:** Second-pass notes for maintainer triage. No code fixes are included.
