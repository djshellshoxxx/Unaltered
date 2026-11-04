# Native Chromium read-stall A/B — summary of the diagnostic records

This is a summary only. The design record and input manifest stay on the diagnostic branch, as their README requires
("Keep this workflow and its records on diag/read-stall-ab-20261102. Do not merge them into a product or release
branch."). They are not copied here.

## Where the records are

| Record | Location | Git blob | SHA-256 |
|---|---|---|---|
| Design record | `docs/diagnostics/read-stall-ab-20261102/README.md` on `diag/read-stall-ab-20261102`, added in `98ad3d5`, unchanged at tip `d77763e8ba9a52f20b22752de273aeb5058f0f4b` | `4ed57480bf5464f448ebccce4c68dd787062a70e` | `fa225a38d5e52efb74cbdae5d3491151c01818ad5056db2dc02a99a626582259` |
| Input manifest | `docs/diagnostics/read-stall-ab-20261102/manifest.json`, same branch and commits | `8b860d2bbeb9b25fb233ccc9ad5d80dfa1d61423` | `c68c546fb38e97e19a8a0b0ca5581c02ce09a553ba6292afc88d59bfa67f2d24` |
| Diagnostic workflow | `.github/workflows/diag-read-stall-ab-20261102.yml`, same branch | — | — |

Read them with `git show d77763e8ba9a52f20b22752de273aeb5058f0f4b:<path>`. The branch must not be deleted while this
summary refers to it.

## Design (as frozen on 2026-11-02)

- **Question:** can the historical hashing family reproduce a native pending-read failure under the same current
  scaffold on which the candidate completes? The arms swap the hashing family as a unit, so the comparison cannot
  isolate one patch or prove Chromium's internal root cause.
- **Arms:** candidate `03f3ac80cfe6f3014162967b5e05bff95ec350b6`. The baseline arm restores only
  `src/core/hash/stream.ts`, `hasher.ts` and `hasher.worker.ts` from `0b448d887df89fab22f701810197e51285590e2b`. Every
  other file stays at the candidate.
- **Runtime:** Node 22.23.4, npm 10.9.9, Playwright 1.64.1, Chromium 156.0.8078.4 (Playwright revision 1248), standard
  `ubuntu-latest` runners.
- **Test, unchanged:**
  - A real 2 GiB sparse file.
  - Worker completion with the full byte count, plus an independent Node SHA-256.
  - A 540 s digest wait and a 600 s test timeout.
  - Less than 200 MiB extra renderer RSS.
  - 4 MiB chunks and the 64 MiB cross-check policy.
- **Matrix:** 8 shards per arm, 3 planned attempts per job, so 48 planned attempts (24 per arm).
  - Zero retries, and the first failure stops the job. Attempts left unreported are never counted as passes.
  - Each job is capped at 40 minutes. The ceiling is 650 runner-minutes per invocation.
- **Interpretation rules (from the record):**
  - A baseline stall together with candidate completion supports recovery under the observed conditions.
  - Both arms passing means non-reproduction, not resolution.
  - RSS, integrity, setup or infrastructure failures keep their own classification.
  - Cohorts and retries are never mixed.

## Results

Run [41561857747](https://github.com/djshellshoxxx/Unaltered/actions/runs/41561857747). The per-shard extraction is in
[docs/ULTRA_RUN_BOARD.md](../ULTRA_RUN_BOARD.md) ("Native stall A/B") and the 2026-11-04 section of
[docs/TODO.md](../TODO.md):

- Candidate family: 24/24 attempts passed.
- Historical family: failed 6 of 8 shards at 540 s with a stuck pending read.
- This is a diagnostic only. It does not establish Chromium's root cause.

The earlier comparison at diagnostic head `6f5b6c9` is
[run 40617290194](https://github.com/djshellshoxxx/Unaltered/actions/runs/40617290194): baseline shards 1/2/4/7/8
failed, 3/5/6 passed, and all watchdog shards passed.
