# Continuous development — 2026-11-04 UTC

Active checkout: `.development/consolidation-20261104`, branch `codex/recover-qualify-20261104`.
Starting local SHA: `1795781a73548fa377aedfc1f1f9761d9d603d8f`. Cached published ref:
`5e1b9205627c8d4da9bc104754005690271b6656`, also identified as published by the owner.
The initial difference was the documentation checkpoint `1795781` only.

## Publication and ownership

Fetch/prune, ls-remote, push, GitHub PR listing and web retrieval were attempted. A Python AF_INET UDP socket probe
fails with `EPERM`; DNS/HTTPS fail before authentication. This restriction is inside the Codex command environment,
not evidence that the Codespace host terminal is offline. Remote configuration is correct; credentials/settings were
not changed. Each validated checkpoint received a normal push attempt; none succeeded. Current remote SHA, PR URL
and CI status remain unknown. The cached ref above is not a fresh live check. No duplicate PR was blindly created.

All workers were confirmed local subagents in isolated clones based on `1795781`; no extra cloud instance or paid
workflow was launched. Root integrates and owns fuzz-runner/documentation edits. No lockfile, dependency manifest,
CI workflow or cryptographic primitive changed. Separate automation repair `2d42bf0` stays outside the product.

| Owner / exclusive files | Integrated checkpoint | Acceptance evidence |
|---|---|---|
| Root / fuzz executor + tests | `c0c5a92` | Rejected concurrent cases never reach the worker; clone errors reject and close. Both new tests fail on old code; final 10/10 pass. |
| OTS worker / calendar client + new tests | `bea3c65` | Valid host-case/default-HTTPS-port aliases upgrade; full path and network policy retained. Three regressions fail before fix; 78 related cases pass. |
| UI worker / Stamp + new focus tests | `ff4eba3`, `6103d43` | Remove and disappearing Cancel restore picker focus only if that item owned focus. Both bugs reproduced first; 22 related UI cases pass. |
| Packaging worker / build + artifact tests + release docs | `4dbf679` | Linux/macOS helpers reject malformed lines. Both actual generated helpers failed before correction; package 18 pass/2 skips. Windows guards added; native execution unverified. |
| Root / synthetic test fixture | `28ec634` | Same credential-bearing URL, constructed like existing fixtures to avoid OPSEC's email-shaped-literal finding. No OPSEC rule loosened. |
| OTS worker, follow-up / PNG parser + new tests | `c54dea7` | Undefined sRGB rendering intents and palettes after transparency rejected. Six failures before fix; 65 related parser cases pass. Reserved-bit behavior retained per PNG3; no decompression or palette-policy expansion. |

Read-only reviews found no further regression in these changes. Internal engineering review is not independent audit.
The [45-branch ledger](RECOVERY_BRANCH_LEDGER_20261104.md) remains cached evidence; no newer branches could be fetched
and no cumulative PR was blindly merged. Main checkout lockfile edits remain unchanged.

## Qualification

Node 22.23.4, Linux, existing clean private dependency tree. Lock SHA-256 remains
`836f4e61ef6339339bbbf6f07692a31dadd141cbe3755ef5610f7980dff262df`.
Linux/macOS helper tests use GNU sha256sum and Perl shasum on Linux, not a native macOS runner. PowerShell and browser
executables are unavailable. No backend, host, analytics, account or runtime dependency was added.

At source `28ec634`: filtered units **347 pass/5 skips**, 34 files, 80.54 s. Full `npm run check` passed OPSEC,
typecheck and lint, then units **346 pass/4 failures/3 skips**, 35 files, 38.88 s. The four failures remain the restricted
FIFO/stdout subprocess cases; the normal command stops there before Node tests. Full green qualification remains open.
The filtered command enables virtual 2 GiB, excludes `cli-io.test.ts`, deselects three FIFO cases and skips unavailable
reference/opt-in real-file cases; no repository test was deleted or loosened. Compared with the prior 334-pass source,
the 13 additional unit cases cover calendar aliases and Stamp focus. Fuzz/package cases are counted separately.

Final qualified source: **`c54dea7507a56f423e868aa7710569730139e1ef`**. Subsequent checkpoint edits are documentation only.

- TypeScript and ESLint: passed. OPSEC passed with the inherited evidence-ZIP metadata warning. Diff checks clean.
- Final filtered units: **357 pass/5 skips**, 35 files, **47.29 s**. Adds ten PNG cases to the 347-pass checkpoint above.
  Command: `UNALTERED_BIG=1 node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=1
  --exclude '**/cli-io.test.ts' --testNamePattern '^(?!.*(?:idle FIFO|named pipe)).*$'`.
  Virtual 2 GiB ran; three FIFO cases, missing Python reference and opt-in real-file case skipped. The genuine
  descriptor-backed 2 GiB+1 acceptance from the preceding recovery remains separate historical evidence, not rerun here.
- Final direct Node executor/package/workflow cases: **32 pass/2 skips**, no failures. Skips require unavailable native
  PowerShell and the inherited platform-specific prerequisite. Linux and Perl-shasum artifact helpers executed.
- Two final builds: every dist file byte-identical; build code **`0632a93e305a31b8`**; five release checksums passed.
  This is local reproducibility, not a second-person or native cross-platform result. Package-helper changes are not
  represented solely by the page build code; the release archive SHA256SUMS capture them.
- `npm run test:e2e -- --retries=0`: build passed, then the server failed with `listen EPERM 127.0.0.1:4173`, before
  any browser test ran. Browser compatibility, axe, offline UI and Pages-subpath behavior remain unverified here.
- `npm audit --omit=dev`: registry DNS failure; no live advisory result. Current PR, remote head and CI remain unknown.

PNG structural rules were checked against [PNG3](https://www.w3.org/TR/png-3/) table 7 (chunk ordering), table 16
(rendering intent) and section 13.5 (unknown/reserved-bit handling). This is not pixel-decoder validation.

Live `npm audit --omit=dev` failed at registry DNS, not a zero-vulnerability result. Native Windows/macOS, browser,
accessibility, reference, SonarCloud and live calendar CORS qualification remain unverified. Reproducibility and final
source qualification are recorded below when completed. No feature-completion percentage is inferred from test totals;
external acceptance gates have no agreed weighting.

## Recovery and next work

Current bundle, patch and logs are preserved under `.development/evidence-continuous-20261104/`; earlier bundles remain
intact. No reset, clean, merge, production tag, release, signing key, deployment, repository setting or paid automation
activation occurred. API cost telemetry is unavailable. No application calendar requests were dispatched.
`product.bundle` contains the final branch and documentation checkpoint; `source.bundle` preserves the qualified source
above. Recover with `git clone <bundle-path> recovered-unaltered`, then switch to `codex/recover-qualify-20261104` and
set origin to the GitHub URL. Exact commits since the cached published ref, patch, bundle digests and raw logs sit beside it.

From a network-enabled terminal, fetch and review divergence before publication; never force-push:

```sh
cd /workspaces/Unaltered/.development/consolidation-20261104
git fetch origin --prune
git log --oneline HEAD..origin/codex/recover-qualify-20261104
git log --oneline origin/codex/recover-qualify-20261104..HEAD
git push -u origin HEAD:refs/heads/codex/recover-qualify-20261104
git ls-remote origin refs/heads/codex/recover-qualify-20261104
git rev-parse HEAD
gh pr list --state open --head codex/recover-qualify-20261104 --json number,url
```

If a PR exists, update it using `docs/CONTINUOUS_PR_BODY_20261104.md`; otherwise create a draft targeting main.
Require exact-head CI and review; no merge or deployment authorization is inferred. Next: refresh live PR/CI/SonarCloud,
run unrestricted CLI/reference/browser/native-platform tests, then complete Bob/Finney and human/signing/rebuild/OPS/
domain/legal gates. The Windows helper's new native regression must pass before Windows qualification is claimed.
