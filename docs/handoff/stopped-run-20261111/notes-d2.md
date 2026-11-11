# D2 notes (distortion corpus, measured recovery, scan pipeline)

Worktree `<worktree-d2>`, branch `ws/d-robustness`, base `6ff1cbd`. `$SCRATCH` = this directory.

## Status log (newest last)

- 00:57 Started. Read COMMON.md, D2.md, handoff sections. Baseline (snap-summary.log): check 0, e2e 117 passed,
  QR qualification 2 passed (1.5 min).
- Scratch venv: `$SCRATCH/venv` (python 3.13.18) with `zxing-cpp==3.1.1` (Apache-2.0, no deps) and
  `pillow==13.0.0` (MIT-CMU, no deps). numpy deliberately NOT used (its wheels bundle a GPL-with-exception
  runtime; Pillow + stdlib is enough). Rasterizer: host `pdftoppm` 24.02.0 (already used by qr-pdf.spec.ts and
  installed in CI as poppler-utils).

## Design decisions

- Corpus unit ("variant") = all symbol pages of one printed certificate with one distortion setting, so
  "recovered" can mean byte-identical receipt. Appendix page (no QR) is not part of a variant (cost; covered at
  150 DPI by qr-pdf.spec.ts).
- Master rasters: Chromium `page.pdf()` of the built app (fixed clock so the cover text is stable), pdftoppm at
  600 DPI gray. All distortions are applied to the master, then area-sampled to the target DPI.
- Grids are fixed BEFORE looking at recovery numbers (see generator constants). Never tuned afterwards.
- In-app path = built app in Chromium, recovery file input, worker + jsQR, download compared byte for byte.
- Third party = zxing-cpp `read_barcodes` defaults, frames fed to `scripts/recover-archival-qr.py` `recover()`.

## Commands that worked

(see below, filled as I go)

## Pitfalls

- Playwright wipes `test-results/` at the start of every run: corpus work dir must live elsewhere for chunked runs.
- `qr-decode.ts` is owned by agent C: any pipeline change must wrap `decodeRasterFrames` from the worker.

## Left to do

(see end of file)
