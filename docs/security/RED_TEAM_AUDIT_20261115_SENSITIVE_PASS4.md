# Red-Team Security Audit — Sensitive Components Pass 4 — 2026-11-15

**Repository:** `djshellshoxxx/Unaltered`  
**Source reviewed:** `main` at `0aafc589ef4e6407d25f7bbfcab9c1d077474328`  
**Notes branch:** `security/red-team-audit-20261115`  
**Scope:** archival QR import/reassembly, metadata stripping for JPEG/PNG/WAV/MP3, evidence bundle export, verification-report rendering, local receipt storage UI, and release/deployment workflows.

## Executive summary

This pass concentrated on privacy-sensitive transformations and artifact/release boundaries. **No new exploitable vulnerability was confirmed** in the reviewed paths.

The reviewed implementation has several useful defensive properties: QR images are size-checked before native raster allocation; decoding runs in a disposable worker with a timeout; archival frames are bounded and cryptographically reassembled; metadata cleaners use format-specific allowlists and fail closed on malformed/unsupported input; evidence exports explicitly state that verification was not performed; and release preparation is manual, unsigned, tag-bound, and separated from offline signing/publication.

The previously reported findings RT-01 through RT-05 remain open unless separately fixed. This pass did not retest them dynamically or change application code.

## Sensitive-area review

### 1. Archival QR import and reassembly — no new finding

**Files:** `src/core/archive/qr-image.ts`, `qr-scan.ts`, `qr-scan.worker.ts`, `qr-decode.ts`, `frames.ts`

- PNG/JPEG input bytes are capped at 12 MiB. Header dimensions are parsed before `createImageBitmap`; dimensions are bounded by side length and total pixels.
- Raster input is checked again for safe integer dimensions, pixel count, and exact RGBA buffer length.
- Decode work is transferred to a dedicated worker. Abort and timeout terminate the worker; the image bitmap and canvas are released in a `finally` block.
- The decoder bounds the number of QR symbols and validates archival payload size before retaining frames. Decoded QR contents are treated as bytes; URLs/text are not executed.
- Frame reassembly caps frame count and receipt size, checks version/flags/lengths/indexes, rejects conflicting duplicates and missing frames, checks the assembled length before allocation/copy, and verifies both SHA-256 and domain-separated proof ID.

**Assessment:** No unchecked dimension-to-allocation path, frame-count bypass, or checksum-bypass was established by inspection. The image decoder remains computationally expensive by design, but its input bounds, worker isolation, symbol caps, and timeout materially limit exposure. Browser-specific worst-case CPU/memory behaviour was not stress-tested.

### 2. Metadata stripping and privacy transformation — no new finding

**Files:** `src/core/strip/index.ts`, `jpeg.ts`, `png.ts`, `audio.ts`, `detect.ts`

- Format detection uses magic bytes rather than trusting file extensions.
- Unsupported formats are explicitly returned as unsupported rather than being presented as cleaned.
- JPEG output is rebuilt from a restricted marker set; EXIF/XMP/IPTC/APP data and comments are discarded. The output is reparsed and checked for forbidden markers and trailing data.
- PNG output retains a restricted set of structural/image chunks, validates chunk CRCs and ordering, rejects unknown critical chunks and animated PNG, and checks that no trailing bytes remain.
- WAV output is rebuilt from a chunk allowlist, removes free-text/identity chunks, normalizes padding, and constrains retained chunk fields. RF64 and unsupported codec cases fail closed.
- MP3 tag removal validates frame boundaries and refuses ambiguous trailing tag/audio data rather than guessing.
- The caller hashes the cleaned output, not the original input.

**Assessment:** No metadata-preservation bypass was confirmed in the reviewed allowlist paths. A cleaner cannot guarantee removal of information encoded in the media signal itself (for example, visible text, audio speech, or steganographic content in retained payloads); the product should avoid implying that byte-level metadata stripping is a complete anonymization guarantee.

### 3. Evidence ZIP and verification report — no new finding

**Files:** `src/core/reports/evidence-zip.ts`, `evidence-manifest.ts`, `verification.ts`

- Evidence ZIP creation caps the combined original and receipt input at 16 MiB, snapshots both byte arrays before awaiting hashes, and emits a small fixed set of filenames.
- The manifest contains byte sizes and SHA-256 checksums and explicitly sets `verification: NOT_PERFORMED`.
- Verification report generation rejects malformed digest strings and prevents a `VERIFIED` report without Bitcoin evidence.
- Exported reports explicitly state that they are not signatures and do not replace the original file or receipt.
- JSON serialization is used for report output; the verification UI renders report fields through DOM text nodes rather than interpreting them as HTML.

**Assessment:** No report-forgery or HTML-injection path was confirmed in these export/rendering functions. These files provide integrity metadata, not a signed chain of custody. A recipient must independently verify the original file and receipt.

### 4. Local receipt list and settings — no new finding

**File:** `src/ui/views/settings.ts`

- The receipt list is opt-in and can be disabled.
- The UI exposes removal of individual saved receipt records.
- Displayed labels, timestamps, and digest values are inserted as text nodes.
- Calendar and explorer selection is constrained to the compiled default endpoint lists; settings do not provide arbitrary endpoint entry.

**Assessment:** No injection or arbitrary-endpoint configuration issue was found in this view. This is a UI/source inspection only; storage implementation and browser-origin isolation were not exhaustively re-audited in this pass.

### 5. Release and Pages workflow boundaries — no new finding

**Files:** `.github/workflows/release.yml`, `.github/workflows/pages-deployment.yml`

- Release workflow is manually dispatched, validates an exact semantic-version tag, and requires the tag to resolve to the selected source commit.
- Build jobs use read-only repository permissions, pinned action SHAs, and checkout with persisted credentials disabled.
- The draft-release job rechecks the remote tag after the build, verifies downloaded artifacts against checksums on all three platforms, and creates only an unsigned draft. It does not sign or publish a final release.
- Pages workflow is explicitly an inactive template under documentation and has no repository write permission by default. Its documented activation path requires explicit owner authorization and a reviewed commit SHA; deployment uses the Pages deployment permissions only.

**Assessment:** No automatic release/signing path or unguarded Pages deployment was established in these workflow files. GitHub environment protection, branch protection, and repository-level Actions settings were not inspected, so workflow YAML alone cannot establish the complete deployment control plane.

## Existing findings carried forward

The following prior findings were not re-audited in depth here and should remain tracked until fixed and verified:

- **RT-01 — High, conditional:** starter-tree symlink dereferencing can copy files outside the starter tree.
- **RT-02 — Medium:** app-specific password may appear in process arguments and is written to `.env` without explicit restrictive permissions.
- **RT-03 — Medium:** cloud coding workflow path guard is broader than its stated security exclusions.
- **RT-04 — Low availability hardening:** QR image processing can have high peak memory use.
- **RT-05 — Low availability:** unbounded concurrent hashing for a user-selected multi-file batch.

## Recommended next steps

1. Resolve RT-01 first; ensure project generation cannot follow starter symlinks outside the intended source tree.
2. Resolve RT-02 by removing secrets from command-line arguments and creating secret files with restrictive permissions from the outset.
3. Narrow RT-03's enforced write-path allowlist; do not rely on agent prompts as security controls.
4. Add browser stress tests for maximum QR image dimensions, dense multi-symbol images, cancellation during bitmap decoding, and worker termination.
5. Document the metadata cleaner as metadata reduction, not full anonymization; keep the explicit unsupported/rejected outcomes.

## Validation limits

- Source inspection only; files were fetched from `main` at the commit listed above.
- No application code or workflow was changed.
- No tests, fuzzing, dynamic exploit reproduction, adversarial media corpus, browser stress test, live service interaction, or release execution was performed.
- Repository settings, environment protection rules, branch protection, Actions secrets, and signing credentials were not inspected.
- No claim is made that the repository is vulnerability-free.

**Disposition:** Fourth sensitive-components audit note for maintainer triage. No fixes included.
