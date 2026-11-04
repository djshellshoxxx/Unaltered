# Provenance of these records

`README.md` and `manifest.json` in this directory are byte-for-byte copies of the same paths on the diagnostic
branch `diag/read-stall-ab-20261102`. They were added in commit `98ad3d5` and are unchanged at the branch tip
`d77763e8ba9a52f20b22752de273aeb5058f0f4b`. They were copied during the 2026-11-04 consolidation so that the frozen design of
the native stall A/B comparison stays readable next to its results.

- **Copied:** the design record (question, frozen inputs, arms, bounds) and the input manifest. Both are evidence
  only.
- **Not copied:** the diagnostic workflow `.github/workflows/diag-read-stall-ab-20261102.yml` and all other code on
  `diag/*` branches. As the README says, the workflow must stay on the diagnostic branch. It is not part of any
  product, CI or release path.
- **Results:** run [41561857747](https://github.com/djshellshoxxx/Unaltered/actions/runs/41561857747). The
  extracted per-shard summary is in [docs/ULTRA_RUN_BOARD.md](../../ULTRA_RUN_BOARD.md) ("Native stall A/B") and
  in the 2026-11-04 section of [docs/TODO.md](../../TODO.md).
  - Candidate family: 24/24 attempts passed.
  - Historical family: failed 6 of 8 shards at 540 s with a stuck pending read.
  - This is a diagnostic only. It does not establish Chromium's root cause.
- **Statements that are now out of date:** the README describes preparation as of 2026-11-02, before the run.
  Statements such as "preparation does not establish that a native failure was reproduced" describe that moment;
  the run results above supersede them.
