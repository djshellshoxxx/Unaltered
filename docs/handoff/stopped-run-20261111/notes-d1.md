# Workstream D, part 1 — working notes (agent D1)

Worktree: wt/d1, branch ws/d-independent, base 6ff1cbd.

## Log

- Start: branch had no commits beyond 6ff1cbd, scratch dir was empty. Fresh start.
- Files read so far (before the independent builder exists):
  - briefs/COMMON.md, briefs/D1.md
  - docs/handoff/HARD-PROBLEMS-20261111.md (whole file)
- NOT read (independence rule, until builder + expected hex are committed):
  src/core/archive/frames.ts, src/core/archive/qr-*.ts, scripts/recover-archival-qr.py,
  tests/archival/test_recover_reference.py (any part), tests/archival/golden-v1.hex,
  tests/unit/archival-qr-*.test.ts, tests/helpers/archival-receipt.ts, tests/qualification/*.

## Independence record (golden vectors)

Commit 8c7f17b = builder (tests/archival/independent_frames.py) + expected output
(tests/archival/independent-vectors-v1.json) + self-test (test_independent_vectors.py).

Files read BEFORE 8c7f17b (complete list):
- briefs/COMMON.md, briefs/D1.md, docs/handoff/HARD-PROBLEMS-20261111.md
- docs/ARCHIVAL_QR_PROTOCOL.md (the specification; the only source for the frame layout)
- package.json, .gitignore, .gitattributes, playwright.qr.config.ts,
  .github/workflows/qr-qualification.yml, scripts/opsec-check.sh (first ~200 lines),
  tests/differential/requirements.txt (first 20 lines)
- directory listings only (names, no content): scripts/, tests/, tests/helpers/, tests/unit/,
  tests/archival/, tests/qualification/, tests/differential/
NOT read before 8c7f17b: anything under src/, scripts/recover-archival-qr.py,
tests/archival/test_recover_reference.py, tests/archival/golden-v1.hex, tests/unit/archival-qr-*.test.ts,
tests/helpers/*, tests/qualification/qr-pdf.spec.ts, docs/QR_*.md.

Third-leg checks done outside the builder (all matched):
- smallest vector (receipt 0x00) assembled by hand, digests from coreutils:
  `printf '\0' | sha256sum` = 6e340b9c...17afa01d ; `printf 'UNALTERED-OTS-QR/1\0\0' | sha256sum` = 6f2cbd7e...c337e2d1
- stream rule blocks 0 and 1 for label "last-frame-shorter" with sha256sum.
- the synthetic ots-shaped receipt (100 bytes) parses and re-serializes byte-identically with
  python-opentimestamps 0.4.5 (shared venv, read-only use): PendingAttestation('https://calendar.example').

Spec ambiguities noted from the text alone (before reading any implementation):
- A1 partition rule is not specified (only "nonempty, ordered, contiguous slices"); the builder takes the
  partition as an explicit input and the vector file records it (`slices`).
- A2 "reserved | 0": no explicit reject wording (flags/version say "exactly", compression says "rejected").
  Vector reserved-1 is listed as invalid because the column is "Rule".
- A3 "Identical duplicate frames may be ignored": permissive wording.
- A4 "group by the 16-byte proof ID" (step 2) vs "mixed receipts are rejected" (integration section).
- A5 no per-frame payload limit in the transport; 16,777,216 bytes in <= 4096 frames needs >= 4096 payload
  bytes per frame, more than one QR byte-mode symbol can hold (2953 - 80 = 2873). So the named 16 MiB bound is
  not reachable with real QR symbols: 4096 * 2873 = 11,767,808 bytes is the real ceiling.
- A6 what a recovery tool does with non-frame payloads / one malformed frame next to a complete set.
