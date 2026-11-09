# Archival QR integration validation

## Scope

This integration consolidates the protocol and encoder work from PRs #59 and #60 with current main without replacing the modern layout or the existing evidence/batch features. It adds a binary-preserving local QR image decoder, bounded cancellable scan workers, browser Print/Save as PDF certificates with a complete paper recovery specification, and a favicon derived from the existing Unaltered U/checkmark artwork. It also includes the repeat-file-input reset fix with a failing-before/fixed-after regression test.

## Merged and deployed baseline, independently checked 2026-11-09

PR [#67](https://github.com/djshellshoxxx/Unaltered/pull/67) merged as
`22a8d7e41a092982ea9fb303eb2d2352994cff03`. Its exact main commit passed
[CI](https://github.com/djshellshoxxx/Unaltered/actions/runs/42575009142), including Chromium,
Firefox and WebKit, and the separate [PDF-to-scan qualification](https://github.com/djshellshoxxx/Unaltered/actions/runs/42575009251).
[Pages publication](https://github.com/djshellshoxxx/Unaltered/actions/runs/42575032906) succeeded.
The public page served build `97ab320ffd62b7de`, matching a fresh local build of that commit.
These observed results supersede the earlier pre-merge qualification status below.

The follow-up review found that language changes remounted the QR tools, losing selected receipts,
settings, recovered downloads and active scans. The owner-accepted
[language contract](proposals/LANGUAGE_SWITCH.md) requires preserving this work. Four added browser
regressions failed on the baseline in [CI run 42583369171](https://github.com/djshellshoxxx/Unaltered/actions/runs/42583369171);
the existing PDF qualification still passed. The same selection loss was reproduced through the live UI.

The follow-up retains and relabels certificate/recovery controls, keeps the active decoder and download
ownership intact, and disposes previews when their actual receipt is removed or replaced. It also adds
ten bounded property tests (1,190 generated cases with fixed seeds) for frame reconstruction and image
header parsing, records ADR-013, and corrects the documented scan timeout to 120 seconds.
The owner's follow-up request adds prominent guidance to prefer the digital `.ots` receipt and identifies
the QR certificate as an additional representation/backup of those same receipt bytes.

Local baseline validation: OPSEC, TypeScript and lint passed; 571 Vitest tests passed (5 skipped),
126 Node tests passed (4 environment-dependent skips), and 4 independent Python recovery tests passed.
The follow-up local tree passed the same checks with 581 Vitest tests, 126 Node tests and 4 Python
tests, with the same skips. After the footer touch-target correction, its build code is `4b63d88e60d422e4`. The footer now links to the existing
Circuit Drift Labs Crypto Libertarian wing, whose live page already links back to Unaltered. This is
explicit navigation only; the application fetch allowlist and CSP remain unchanged, and a regression
asserts that `netFetch` still blocks the wing URL.
The first fixed commit `8002f68ccec6231e755573905f2ada79830b2a84` passed all four new
state/download regressions in Chromium. The existing mobile accessibility test caught the new footer
link's 14-pixel target; the link now has a minimum 44-pixel target without changing that test.
Local Chromium launch failed before browser test execution because the executor denied `socket()`;
the browser policy was not changed. Final browser/PDF acceptance and publication are tracked against
the current source commit in [PR #68](https://github.com/djshellshoxxx/Unaltered/pull/68).

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

## Local Chromium qualification on 2026-11-09

This session's preinstalled Chromium could run the browser suites the earlier session could not. The first run exposed
three defects, now fixed with regression tests:

1. **Printed certificates did not recover.** The planner chose QR version 38 (0.41 mm modules). jsQR misjudges the
   module grid of large versions at non-integer print/scan scales, so A4 and Letter PDFs at 150 DPI recovered nothing.
   The planner now requires 0.62 mm modules (version 23 or lower) and the decoder retries a missed region at two
   area-averaged scales. `tests/unit/archival-qr-print-scale.test.ts` covers 141 to 300 DPI and fails before the fix.
   Largest printable receipt: about 24 KiB at H and 64 KiB at L within the 64-symbol limit; larger receipts stay digital.
2. **Symbols below the page header were missed.** Fixed half/quadrant/third search windows cut through symbols on
   continuation pages. The decoder now first locates dense, square ink blobs and keeps the windows as a fallback.
3. **Two "Cancel" buttons on Verify.** The QR scan's Cancel shared its accessible name with Verify's Cancel and broke
   three existing Verify e2e tests. It is now "Cancel QR scan" / "Cancelar escaneo QR".

Audit follow-ups: a language switch now disposes the replaced recovery panel (stops its worker and releases its
download URL), and the per-image decode timeout is 120 s instead of 45 s (a 16-megapixel text page took 24.5 s here).

Results at the final local tree: `npm run check` passed (571 Vitest passed, 5 skipped; 128 Node passed, 2 skipped);
Chromium e2e 110 passed, 1 skipped; `playwright.qr.config.ts` A4 and Letter print to PDF, rasterize at 150 DPI, decode and
offline in-app recovery passed with byte-exact receipts. Firefox and WebKit were not available locally and remain for CI.

## Limitations retained

- Physical paper printing and camera capture have not been tested here. PDF rasterization is not a claim of universal hardware scanning reliability.
- Certificates preserve a standard receipt; they do not contain the original file or claim Bitcoin verification. Recovery verifies frame/receipt integrity and parses the .ots structure, not Bitcoin confirmation.
- Print output is bounded to 64 symbols; larger receipts remain digital and are not truncated.
- Image recovery accepts PNG/JPEG scans, exported PNGs and raw binary frames, not PDF files directly.
- Compression and a separate link-only certificate mode are not included in this integration.
- The technical recovery appendix is English; the application controls have English and Spanish translations.
- Merge and public Pages deployment must be reported separately.
