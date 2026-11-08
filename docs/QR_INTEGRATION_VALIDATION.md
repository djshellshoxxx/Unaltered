# Archival QR integration validation

## Scope

This integration consolidates the protocol and encoder work from PRs #59 and #60 with current main without replacing the modern layout or the existing evidence/batch features. It adds a binary-preserving local QR image decoder, bounded cancellable scan workers, browser Print/Save as PDF certificates with a complete paper recovery specification, and a favicon derived from the existing Unaltered U/checkmark artwork. It also includes the repeat-file-input reset fix with a failing-before/fixed-after regression test.

## Local checks on 2026-11-08

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test`: 562 Vitest tests passed, 5 existing skips; 127 additional Node tests passed, 3 existing skips; no failures.
- `python3 -m unittest discover -s tests/archival -p 'test_*.py'`: 4 passed.
- `npm run build`: passed; 119.8 KiB gzip; single-file HTML 357 KiB. Local build code: `6970fc27767cc50c`.
- Local favicon PNG SHA-256: `b0c89ece3a0242003d9de0e62a493a04ad3f77ba52c58eb542428e792a32a9f6` (64 x 64 pixels).
- Pixel-level tests use Nayuki encoding and independent jsQR decoding, including L/M/Q/H, rotation, multiple symbols on a raster, mixed/incomplete sets, exact receipt byte equality and resource bounds. They do not simply return retained frame bytes.
- Complete jsQR, Nayuki, noble-hashes and project notices are checked in distributed outputs.

The local browser is restricted by administrator policy from navigating local/file URLs. That restriction was not bypassed. The full browser matrix and PDF print-to-scan qualification therefore run on GitHub-hosted runners.

## Hosted qualification required before merge

The dedicated `Archival QR print and scan qualification` workflow builds real Chromium PDFs for A4 and US Letter, rasterizes them at 150 DPI, decodes the page images, compares recovered .ots bytes, and imports the scanned PNG pages through the offline browser worker. Ordinary CI separately covers Chromium, Firefox and WebKit, the favicon, repeated file selection, CSP, accessibility and existing regressions. Record the final exact-SHA results here; defining these tests is not evidence they passed.

The temporary snapshot and patch-transfer workflows have been removed from the integration tree. The retained qualification workflow has read-only repository permissions. No Pages publication permissions, review gates or runtime network allowlist were loosened.

## Limitations retained

- Physical paper printing and camera capture have not been tested here. PDF rasterization is not a claim of universal hardware scanning reliability.
- Certificates preserve a standard receipt; they do not contain the original file or claim Bitcoin verification. Recovery verifies frame/receipt integrity and parses the .ots structure, not Bitcoin confirmation.
- Print output is bounded to 64 symbols; larger receipts remain digital and are not truncated.
- Image recovery accepts PNG/JPEG scans, exported PNGs and raw binary frames, not PDF files directly.
- Compression and a separate link-only certificate mode are not included in this integration.
- The technical recovery appendix is English; the application controls have English and Spanish translations.
- Merge and public Pages deployment must be reported separately.
