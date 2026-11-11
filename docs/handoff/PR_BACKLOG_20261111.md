# Pull-request backlog ledger, 2026-11-11 UTC

Workstream E of `docs/handoff/HARD-PROBLEMS-20261111.md`. Base: `main` at `556fc2d`. Read-only inspection of every
open PR head (`git fetch origin '+refs/pull/*/head:refs/prs/*'`). No PR was closed, merged, commented on, labelled
or pushed to. No workflow was edited or dispatched.

Method per PR: head SHA; merge-base with `main`; `git merge-base --is-ancestor` (ancestry); `git cherry` (patch-id);
per-file blob comparison of the PR head against `main` (tree comparison, needed because `main` is built from squash
merges so patch-ids never match); `git merge-tree --write-tree` for conflicts with `main`; CI conclusion where it was
read. "Ancestry" is `no` for every PR: none of the heads is contained in `main`. `git cherry` reports every PR commit as
unique (`+`) for the same squash-merge reason, so it proves nothing on its own; the tree comparison column is the
meaningful one.

## Integrated onto the E worktree branch (cherry-picked with `-x`)

Only commits whose files are all inside the E-owned paths were taken. Each regression test was run on `main` plus the
test commit alone (fails) and again after the fix commit (passes).

| PR | Commits taken (source SHA) | Files | Fails on main | Passes after |
|----|----------------------------|-------|---------------|--------------|
| #74 evidence ZIP snapshot | 13c5b40 (test), 9b1e586 (fix), b3a481d (test typing) | `src/core/reports/evidence-zip.ts`, `tests/unit/evidence-zip.test.ts` | "captures caller-owned input bytes before asynchronous hashing and ZIP assembly": got `[238,238,238,238]`, expected `[0,1,2,3]` | yes |
| #75 batch cancel result | 3066c6c (test), f242dad (fix) | `src/core/reports/batch-verify.ts`, `tests/unit/batch-verify.test.ts` | "does not turn a cancelled in-flight verification into a misleading error result": 2 results instead of 1 | yes |
| #76 batch empty names | fb3b5f9 (test), 1341531 (fix) | `src/core/reports/batch-pair.ts`, `tests/unit/batch-pair.test.ts` | "rejects unnamed originals and receipts ...": expected function to throw | yes |
| #71 CLI parity (code part only) | 9ab0735 | `src/cli/run.ts`, `tests/unit/cli-parity.test.ts` | with `src/cli/run.ts` restored from `main`: 14 of 15 tests fail | 15 of 15 pass |

Docs-only commits of #74/#75/#76 (`docs/handoff/CHATGPT_ZERO_CODEX_LATEST.md`) were not taken.

## Needs lead (not integrated: commit touches paths outside the E set)

| PR | Commit | Files outside E paths | Note |
|----|--------|-----------------------|------|
| #77 receipt time order | 9a879f8 (test, owned paths) and 2b5d19f (fix) | 2b5d19f also adds `docs/handoff/CHATGPT_ZERO_CODEX_LATEST.md` | Fix is 2 lines in `src/core/reports/receipt-dashboard.ts`. The test fails on `main` ("orders canonical UTC timestamps by instant ...": got `2026-11-02T00:00:00Z`, expected `...00.001Z`). Lead can cherry-pick `9a879f8` and `2b5d19f` and drop the handoff file, or take them whole. |
| #78 QR plan page minimum | b44d05a (test) and 90031b3 (fix) | both also touch `docs/handoff/CHATGPT_ZERO_CODEX_LATEST.md` | Owned files: `src/core/archive/qr-plan.ts` (+2), `tests/unit/archival-qr-plan.test.ts` (+7). Regression not run here. |
| #71 CLI parity (rest) | 87429ad | `src/core/archive/qr-print.ts` (distinct-host certificate check), test `tests/unit/archival-certificate-evidence.test.ts` | Separate fix; `qr-print.ts` is not an E path. |
| #71 CLI parity (docs) | c4e43c7 | `HANDOFF.md`, `README.md`, `docs/CLI.md`, `docs/RELEASE.md`, `docs/TODO.md`, `docs/handoff/CLAUDE-CLI-PARITY-20261110.md` | `docs/CLI.md` should accompany the code from 9ab0735. |
| #65 repeat file selection | 72c7967, cba2ce0 | `src/ui/dom.ts`, `tests/e2e/app.spec.ts` | Conflicts with `main` in `src/ui/dom.ts`. Needs a rebase by the lead or owner. |

## Ledger

Columns: head (9 chars) | merge-base | files in PR diff (identical-to-main / differing) | merge with `main` | CI | recommendation.
CI: "pass*" means every required check passed and only the informational "Live check of calendars and explorers" job failed
(the egress in CI is not the problem there; it is the known R1 CORS state). "not read" means I did not query it.

| PR | Head | Base | Merge-base | Files (same/differ) | Merge | CI | Content | Recommendation |
|----|------|------|-----------|---------------------|-------|----|---------|----------------|
| #41 | d35291677 | main | 1b6dd91 | 0/1 | clean | not read | workflow `unaltered-codex-cloud.yml` | leave; owner decision about the automation (see below) |
| #42 | db519a9e2 | #41 branch | 1b6dd91 | 0/1 | clean | not read | same workflow, 4 parallel agents | leave; stacked on #41 |
| #48 | 9abae9dee | main | 1b6dd91 | 43/30 | CONFLICT | not read | consolidation branch, 96 commits; `main` differs from it in 216 files, mostly because `main` is ahead | superseded in large part by #61-#69; needs owner |
| #49 | dde46eab7 | #48 branch | 1b6dd91 | 45/29 | CONFLICT | not read | OpenAlex sort parameter fix, stacked on #48 | needs owner; lift the single fix if still wanted |
| #50 | 3811638d9 | main | 1b6dd91 | 0/1 | clean | not read | audit doc `docs/UNALTERED_CONSOLIDATION_AUDIT_20261104.md` | leave (historic) |
| #52 | 269118949 | main | 1b6dd91 | 0/4 | clean | not read | `.github/scripts/cloud_scope_guard.py` and test, workflow, `docs/AUTOMATION_SCOPE_20261104.md` | needs owner (touches workflow) |
| #53 | 092829b8a | `codex/recover-qualify-20261104` | 1b89621 | 0/1 | clean | not read | `pages-readiness.yml` npm cache | needs owner (workflow, stacked base) |
| #55 | c20959681 | main | 1b6dd91 | 0/1 | clean | pass* (SonarCloud, CodeRabbit ok) | bump `peter-evans/create-pull-request` 7.0.11 to 8.1.1, used only in `unaltered-codex-cloud.yml` | do not integrate; owner decision with the automation |
| #56 | 93b9d41b3 | main | 1b6dd91 | 0/2 | clean | pass* | `@types/node` 26.6.5 to 26.6.6 | needs owner (lockfile; lead may merge) |
| #57 | 86c8d738e | main | 1b6dd91 | 0/2 | clean | pass* | `typescript-eslint` 8.72.0 to 8.72.1 | needs owner (lockfile; lead may merge) |
| #58 | 9ca6454a0 | main | e1e9415 | 0/5 | CONFLICT | not read | beta landing, process guide, tooltips | superseded by #64/#63 and later UI work; needs owner |
| #59 | ab46b7ae6 | main | e1e9415 | 0/3 | CONFLICT | not read | archival QR frames phase 1 | superseded: `src/core/archive/frames.ts` etc. already on `main` via #66-#69 stack (content differs) |
| #60 | cb703a470 | #59 branch | e1e9415 | 6/15 | CONFLICT | not read | QR optimizer phase 2a, 64 commits | superseded in large part; needs owner |
| #63 | 311ec0242 | main | 7b62c66 | 0/4 | CONFLICT | not read | SEO and visual identity, `scripts/build.mjs`, `index.html` | needs owner (build script) |
| #64 | 9eacdd93e | main | 7b62c66 | 0/7 | clean | not read | contextual help, `strings.ts`, `verify.ts`, e2e | needs owner; touches strings and views |
| #65 | 72c796707 | main | 7b62c66 | 0/2 | CONFLICT | not read | repeat file selection fix, `src/ui/dom.ts` | needs lead (see above) |
| #66 | 177cd3298 | main | 7b62c66 | 35/19 | CONFLICT | not read | QR recovery and favicon consolidation; `main` differs in 33 files, mostly deletions (main ahead) | superseded by #67-#69; needs owner for favicon remainder |
| #70 | 5b03393f9 | main | 556fc2d | 0/1 | clean | not read | continuation spec doc | leave |
| #71 | c4e43c7b9 | main | 556fc2d | 0/10 | clean | pass* | CLI parity and certificate distinct-source check | integrated code part; rest needs lead |
| #72 | 260719ebe | main | 556fc2d | 0/8 | clean | not read | wiki docs, 23 commits | needs owner (docs) |
| #73 | 3f3086e4f | main | 556fc2d | 0/1 | clean | not read | audit ledger doc, 13 commits | leave |
| #74 | aa2382bfe | main | 556fc2d | 0/3 | clean | pass* | evidence ZIP snapshot | integrated |
| #75 | 64a7a8213 | main | 556fc2d | 0/3 | clean | not read | batch cancel result | integrated |
| #76 | 6dfcfdfd6 | main | 556fc2d | 0/3 | clean | not read | batch empty names | integrated |
| #77 | a2f0c62d0 | main | 556fc2d | 0/3 | clean | not read | receipt time order | needs lead (doc file in fix commit) |
| #78 | 90031b315 | main | 556fc2d | 0/3 | clean | not read | QR plan page minimum | needs lead (doc file in both commits) |

Ancestry result for all 26: not contained in `main`. `git cherry`: all commits `+` for all 26 (squash-merge artefact).
The CI for #74 and #71 was read at their head SHAs (15 checks each: all success except the informational live check).
The CI for #55, #56 and #57 was read at their head SHAs (16 checks: all success except the informational live check).
SonarCloud passed on #55, #56 and #57 (the SonarCloud finding itself is out of scope here).

## Failing scheduled workflow "Unaltered API-Funded Cloud Development"

Runs 42690811469 (2026-11-09 20:13 UTC) and 42863867428 (2026-11-10 17:20 UTC), event `schedule`, head `main` at
`556fc2d`. In both runs jobs `develop` fail at the step "Run API-funded Codex" after about 20 s; all other steps up to
"Install pinned dependencies" succeed; "Validate modified paths", checks, packaging and the `publish` job are skipped.

Job log (identical in both runs): `ERROR: Quota exceeded. Check your plan and billing details.` printed twice by
Codex, followed by `Error: /usr/bin/sudo exited with code 1` from the `openai/codex-action` wrapper
(`dist/main.js:25039`). No code, test or repository change is involved.

Cause: the OpenAI API account behind the workflow's key has no remaining quota or billing.
Smallest owner action: restore billing or quota on the OpenAI account whose key is stored as the repository secret
used by the workflow, or disable the schedule in the repository's Actions settings until funded. Not done by this
workstream (no workflow edit, disable or dispatch).
