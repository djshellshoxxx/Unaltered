# Archival QR recovery and favicon implementation plan

Goal: integrate the work from PRs #59 and #60 with current main, complete local QR image recovery, qualify browser Print/Save as PDF output, and add a local favicon using the existing Unaltered mark.

Architecture: preserve ordinary .ots bytes in UNALTERED-OTS-QR/1 frames. Reuse the existing Nayuki encoder and add an independently implemented, exact-version-pinned binary QR decoder. Images and receipts stay local. Printing and file downloads are explicit user actions. No CSP weakening, external fonts, analytics or new network endpoints.

The user has authorized implementation and merging once validated. A printed certificate transports a receipt; it must not claim a verified Bitcoin timestamp unless real verification has established one. A physical paper/camera test cannot be claimed from a rasterized PDF test.

## Tasks and acceptance

- [ ] Establish current-main baseline and an isolated integration branch. Preserve modern layout, existing evidence export and pending unrelated PRs.
- [ ] Reproduce missing favicon and QR-image-recovery behavior with tests before implementation.
- [ ] Consolidate QR protocol/encoder branches, preserving bounds, MIT notices and golden-vector tests. Do not copy old main UI files over new main changes.
- [ ] Add locally bundled binary QR image decoding with bounded files, pixels, frames and cancellation; reject mixed, corrupt and incomplete sets. Recover exact .ots bytes, then parse the receipt before presenting it as usable.
- [ ] Qualify generated QR matrices, exported PNGs and browser-printed PDF rasters with an independent decoder. Exercise all correction levels, shuffled/duplicate frames, foreign proofs and incomplete sets.
- [ ] Add the existing Unaltered mark as a favicon. Generated link markup must remain owned by the builder; no source-template exception and no extra remote request. Cover hosted and single-file behavior.
- [ ] Run typecheck, lint, unit/reference tests, browser CSP/accessibility and regression tests. Inspect rendered output.
- [ ] Publish one coherent integration commit/PR, verify its exact CI SHA, merge only passing work, and document whether live Pages deployment has actually occurred.

## Review focus

1. Input bytes changed during async work: snapshot/ownership guards prevent stale exports.
2. Dense multipage QR printouts: enforce physical module and page limits, preserve quiet zones.
3. Mixed or duplicate frames: identical duplicates may deduplicate; conflicts fail closed.
4. Offline build: no runtime CDN/decoder fetch, no loss of byte values through text conversion.
5. Favicon and third-party code: deterministic build hashes and distributed license notices remain complete.

## Execution notes

The local shell has no GitHub DNS access. GitHub Actions may supply a short-lived source/dependency snapshot for local reproduction. The temporary snapshot workflow is removed before merge; only tracked source and locked dependencies are archived, never .git credentials, environment variables, or tokens.
