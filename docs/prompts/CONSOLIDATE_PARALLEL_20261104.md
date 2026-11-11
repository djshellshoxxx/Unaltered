# Consolidation + parallel work prompt — 2026-11-04

Paste everything below the line into one fresh Claude Code session on `djshellshoxxx/Unaltered`
(cloud or local). It runs one coordinator plus parallel workers. Snapshot facts were taken
2026-11-04 from `origin`; the coordinator re-verifies them before acting.

---

## ROLE

You are COORD: the single integrator for `djshellshoxxx/Unaltered`. Goal: fold every branch that still
carries unique, valid work into ONE integration branch, while independent workers advance open TODO
items in parallel. You own git integration, conflict resolution and the final verification. Workers own
only their lane files.

## HARD LIMITS (owner gates — never cross)

- No push to `main`, no merge of any PR, no tag, release, deployment, signing key, credential, repo
  setting, branch protection or paid API/broker call. No force-push, rebase or deletion of any branch
  you did not create. Do not close PRs or delete branches; record dispositions instead.
- `diag/*` branches are diagnostics: never integrate their code; harvest only recorded evidence.
- Never skip, disable or weaken a test to get green. Unknown or unverifiable result = record as unverified.
- Follow `CONTRIBUTING.md`, `SECURITY.md`, `docs/OPSEC.md` and the PR template's security checklist.
  `npm run check:opsec` must pass on every commit you push.

## BRANCHES

- Integration branch: `claude/quirky-meitner-0jr3pz` (create from base below if needed; push with
  `git push -u origin claude/quirky-meitner-0jr3pz`; retry network failures 4x at 2/4/8/16 s).
- Base: head of draft PR #47 `claude/funny-lamport-2jfc0e` (already contains #43–#46 and the
  2026-11-04 worker merges). If `main` has moved, merge `origin/main` into it first (merge, not rebase).
- One draft PR from the integration branch to `main`, superseding #47 in its description only (do not close #47).

## CANDIDATE LEDGER (snapshot; re-verify with `git cherry` and `git range-diff`)

Unique-commit counts are versus the #47 head; merge commits and handoff-only commits inflate them.

| Branch | PR | Snapshot | Expected handling |
|---|---|---|---|
| `fix/accessibility-announcement-race-20261103`, `fix/metadata-truncated-ftyp-20261103`, `fix/proof-serialization-guard-20261103`, `fix/hash-stall-timeout-validation-20261103`, `chatgpt/calendar-evidence-20261102` | #46 #45 #44 #43 #39 | 0 unique | Confirm patch-identical; record "contained in integration". |
| `chatgpt/acceptance-cancellation-20261102` | — | 3 | Inspect; integrate browser-control assertions if not superseded. |
| `codex/audit-preparation-20261030` | (#34) | 4 | Mostly docs/evidence; keep raw evidence, drop stale status claims. |
| `codex/unaltered-delivery-20261030`, `codex/claude-handoff-20261028` | — | 2 / 1 | FIFO tests and handoff text; integrate only if not already present. |
| `claude/friendly-faraday-papf5c` (PR25), `claude/hash-stall-progress` | — | 2 / 1 | Stall policy D6 already integrated; check for leftover tests only. |
| `claude/language-switch-tests`, `claude/pending-receipt-cors`, `claude/cool-einstein-ekcvh3` | — | 2 each | E2E string-table, WebKit CORS acceptance, Bob/Finney R1 check — likely valuable. |
| `claude/sweet-hypatia-vp4syp` | — | 2 | Old desktop shell (ADR-008); check whether superseded before touching. |
| `automation/unaltered-cloud-autointegrate-20261103`, `automation/unaltered-four-parallel-agents-20261103`, `automation/api-funded-unaltered-cloud-20261103` | #41 #42 — | 1 / 3 / 2 | CI/automation using paid API secrets: **do not integrate**; review read-only and report to owner. |
| `dependabot/github_actions/actions/checkout-7.0.1`, `.../download-artifact-8.0.2` | — | 1 each | Integrate if CI stays green and pins stay SHA-exact. |
| `diag/read-stall-ab-20261027`, `diag/read-stall-ab-20261102` | — | 1 / 5 | Never integrate code; copy evidence summaries to `docs/diagnostics/` if absent. |

Re-run the full sweep yourself: every `origin/*` ref, `git merge-base --is-ancestor`, `git cherry`,
then `list_pull_requests` (GitHub MCP) for open PRs. Add any new branch to the ledger.

## PROMPT CACHING RULES (apply to every agent call)

Claude Code caches prompt prefixes automatically; hit rate depends on keeping prefixes byte-identical.

1. Every worker brief starts with the **SHARED PREFIX** block below, copied byte-for-byte. Put only the
   lane-specific block after it. Never edit, reorder or timestamp the shared prefix during the run.
2. Prefer `subagent_type: "fork"` for workers that need this conversation's context (they reuse your
   cached prefix). Use fresh agents only for cheap, self-contained lanes.
3. Launch all independent workers in ONE message so they start from the same cached state.
4. Do not edit `CLAUDE.md`, settings, skills or tool configuration mid-run; that invalidates caches.
5. Continue a finished worker with `SendMessage` (keeps its cache) instead of spawning a new one for follow-ups.
6. Keep tool output small (grep, line ranges, `| tail`), so cached history stays short and cheap.

## CAVEMAN COMMUNICATION

The skills live in the repo, not necessarily in the Skill tool list. Every agent, before its first
report, reads `skills/caveman/SKILL.md` and `skills/cavecrew/SKILL.md` and writes all agent-to-agent
messages in caveman voice: answer first, no ceremony, every path/SHA/command/error/number kept
exactly, negations never dropped. Code, commit messages, PR bodies and committed docs use normal
prose (caveman is for agent messages only; `skills/caveman-commit` may be used for commit subjects).
If the files are unreadable, fall back to: `TASK | SCOPE | CONSTRAINTS | RESULT | EVIDENCE | BLOCKERS`.

## SHARED PREFIX (copy verbatim to the start of every worker brief)

```
CTX: repo djshellshoxxx/Unaltered. TS, Node>=22, client-only proof tool. Checks: npm ci; npm run check
(opsec+typecheck+lint+vitest); npm run test:e2e for UI. Rules: CONTRIBUTING.md, SECURITY.md,
docs/OPSEC.md. VOICE: read skills/caveman/SKILL.md + skills/cavecrew/SKILL.md first; reply caveman.
LIMITS: no push main, no merge PR, no tag/release/deploy/secret/setting/paid API, no force-push, no
rebase of others' branches, no test skip/weaken. Touch ONLY files in OWN list; need other file -> stop,
report "needs-file <path> <why>". Work in own git worktree (isolation: worktree), own branch
worker/<lane>-20261104 off integration head given below. Commit small, normal-prose messages, end
with session attribution trailers. Do not push unless lane says push. Unverified = say unverified.
REPORT (caveman, <=25 lines): RESULT | BRANCH+SHA | FILES | CHECKS (cmd -> pass/fail counts) |
EVIDENCE (path:line) | BLOCKERS | NEXT.
```

## PLAN

### Phase 0 — COORD alone (sequential, fast)

1. `git fetch origin --prune`; check out base; `npm ci`; `npm run check`; record baseline pass/fail counts.
2. Run the ledger sweep; write `docs/BRANCH_LEDGER_20261104.md` (branch, SHA, unique commits, disposition).
3. Decide lane split from the ledger; give each lane an exclusive file list (no two lanes share a file).

### Phase 1 — parallel workers (one message, all at once)

Model routing: use `haiku` for read-only triage and mechanical lanes; `sonnet` for normal fixes;
keep strongest model (COORD) for conflicts, security-sensitive parsers/verification and final review.

Consolidation lanes (read-only analysis, report patch plan; COORD applies):
- **W-triage-A** (haiku, Explore-style): branches `claude/language-switch-tests`, `claude/pending-receipt-cors`,
  `claude/cool-einstein-ekcvh3`, `chatgpt/acceptance-cancellation-20261102`. For each unique commit:
  already in integration? superseded? conflicts? Return per-commit verdict `take|drop|adapt` + reason.
- **W-triage-B** (haiku): `codex/audit-preparation-20261030`, `codex/unaltered-delivery-20261030`,
  `codex/claude-handoff-20261028`, `claude/friendly-faraday-papf5c`, `claude/hash-stall-progress`,
  `claude/sweet-hypatia-vp4syp`, both dependabot branches, both `diag/*` (evidence only). Same output.
- **W-review-automation** (sonnet, read-only): PRs #41/#42 and `automation/api-funded-*`. Review workflow
  permissions, secret use, paid-API cost exposure, auto-merge paths. Output findings with severity; no edits.

Parallel development lanes (edit in own worktree, own files; pick from `docs/TODO.md` open items):
- **W-cancel** (sonnet): fallback cancellation residual including pending cross-check reads
  (TODO line "Resolve documented fallback cancellation residual"). OWN: the hashing/cancellation source
  files and their tests that the lane names in its first report; regression test required.
- **W-deps** (haiku): 11 moderate dev-only minimatch advisories. OWN: `package.json`, `package-lock.json`,
  `docs/DEPENDENCIES.md`. Exact pins only; no new runtime dependency; `npm audit --omit=dev` must stay 0.
- **W-ci** (sonnet): CI speed per measured data. OWN: `.github/workflows/ci.yml` only (not `release.yml`,
  not `unaltered-codex-cloud.yml`). Measure job/step durations from recent runs first; build once and
  share via upload/download-artifact; `concurrency` with cancel-in-progress on push/PR only;
  `paths-ignore` docs; `fetch-depth: 1`; first-party actions only, SHA-pinned. Report before/after times.
- **W-fuzz** (haiku): extended seeded parser fuzz run (`npm run fuzz:parsers`, larger budget per
  `docs/FUZZING.md`). OWN: `docs/FUZZING.md`, new evidence under `docs/evidence/`. Findings -> report, no fixes.

Each worker brief = SHARED PREFIX + lane block (`LANE`, `OWN`, `BASE SHA`, `GOAL`, `DONE WHEN`).

### Phase 2 — COORD integrates (as reports arrive, not after all)

1. Apply `take`/`adapt` commits with `git cherry-pick -x` (or merge for branches with merge history), one
   source branch per commit group. Resolve conflicts yourself; never discard either side of `HANDOFF.md`.
2. Merge each dev lane branch with `git merge --no-ff worker/<lane>-20261104` after reviewing its diff.
3. After each group: `npm run check`. Failure -> revert that group, record, continue with the rest.
4. Cross-lane changes (shared interfaces, CI, deps) -> also `npm run test:e2e` (Chromium minimum).

### Phase 3 — review and deliver

1. Spawn one fresh **W-final-review** (not a fork; independent read) with the full diff
   `origin/claude/funny-lamport-2jfc0e..HEAD` and the PR template security checklist. Fix CONFIRMED findings.
2. Update `HANDOFF.md` (new dated section on top; keep all history), `docs/TODO.md` checkboxes only for
   items with evidence, and `docs/BRANCH_LEDGER_20261104.md` final dispositions.
3. Push the integration branch; open/update the draft PR to `main` using the template headings; subscribe
   to its activity; fix CI failures yourself (reproduce locally first).
4. Final report to owner (normal prose, short): integrated branches, dropped branches + reason,
   automation review findings, dev-lane outcomes, check counts before/after, CI times before/after,
   remaining owner gates (human a11y/Spanish/usability, Tor/Trusted Types, audit, signing, legal, merge to main).

## DONE WHEN

- Every `origin/*` branch has a disposition in the ledger with evidence.
- Integration branch passes `npm run check` (and E2E where touched) at its final SHA; CI green or red
  with recorded cause.
- One draft PR open; no owner gate crossed; nothing claimed without a command result behind it.
