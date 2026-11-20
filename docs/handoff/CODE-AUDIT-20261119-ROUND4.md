# Code audit round 4 — supported dependency repair

Date: 2026-11-19. Baseline: `1b75b950eb151562415c362e676c569fdd80de55`.
Dependency commit: `b217110e216dca2c1c2ca36329ee6738182351f5`.
Scope: independently review and qualify the now-available supported repair for the development-only minimatch
advisory identified by round three. The worker used its own worktree and its own installed dependencies.

## Outcome

The registry's proposed fix is supported by the actual package manifests. Exact direct pins move from ESLint
10.14.0 to **10.15.0** and typescript-eslint 8.72.1 to **8.73.0**. The latter's declared peers accept ESLint 10 and
the unchanged TypeScript 6.0.3. No forced overrides, broad `npm audit fix`, or unrelated direct upgrades were used.

The resolved minimatch version is **11.0.9**. ESLint and config-array 0.23.6 require `^11.0.5`; typescript-estree
8.73.0 requires `^11.0.1`. These ranges all accept the installed version. The official advisory's patched family
starts at 11.0.1: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).

The previous report contained nine moderate affected package entries from that one advisory. Both current full
and runtime-only audit reports contain zero vulnerabilities. This conclusion is limited to the registry data at
this check; it is not a general proof of dependency safety.

## Lockfile and provenance review

Fourteen existing development package records change, and one new development package is added:
`@isaacs/nonrecursive-glob-match@1.1.0`. The new package is an upstream minimatch dependency, has no runtime
dependencies of its own, declares BlueOak-1.0.0, and provides packaged JavaScript exports. The review checked its
manifest, source imports, exports, registry integrity, and provenance. It is not an independent audit of its
implementation.

The supported dependency resolution initially also refreshed compatible `ignore`, `brace-expansion` and `semver`
patches. Their previous full lock records were retained to keep this repair narrow, then accepted by a clean
`npm ci`. A direct semver check also confirmed each old version still satisfies its consumer's declared range.
No custom resolution or override was introduced.

Production package records are unchanged. All other direct versions remain pinned, including Playwright 1.64.1,
TypeScript 6.0.3 and `@eslint/js` 10.0.1. The newly declared optional `@typescript/native` peer is not installed.
The manifest/lockfile edit has no application, workflow, permission, trigger or paid-automation changes.

File SHA-256 values:

| File | SHA-256 |
|---|---|
| `package.json` | `53a6f9e53d06cfe7777da3d454908251c23b6af681bd3dd0affcd75063062bc1` |
| `package-lock.json` | `543c31f82c9e84a67fac81a7fa9de18ae4371194330e7c0cd2af9d522d6745ef` |

## Verification

Environment: Linux, Node 24.22.3, npm 11.19.1. Install scripts remain disabled by both explicit arguments and the
repository's `.npmrc`.

| Check | Result |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | Passed; 141 packages installed into the isolated worktree. |
| `node --max-old-space-size=384 node_modules/eslint/bin/eslint.js .` | Passed, no diagnostics. |
| `npm audit --json` | Zero vulnerabilities in valid current advisory data. |
| `npm audit --omit=dev --json` | Zero vulnerabilities in valid current advisory data. |
| `npm audit signatures --fetch-timeout=30000 --fetch-retries=0` | Exit 0; 141 registry signatures and 59 attestations verified. |
| `git diff --check` | Passed. |
| Full `tsc --noEmit`, 384 MiB heap | Exit 2; five test-only `TS2352` diagnostics described below. |

A tool transport/runtime replacement lost the original validation process handles. Persisted logs and the
command's exit-status JSON were inspected before any retry. Signature verification was repeated once to obtain
an explicit final exit status; it succeeded. No compiler retry was started while the bug worker's compiler was
running.

Full typechecking identified required `Window` probe assertions in
`tests/e2e/verify-export-batch-lifecycle.spec.ts` at lines 31, 65, 70, 78 and 87. That new test is present on the
supplied baseline, and this dependency update leaves TypeScript and the DOM/Node type versions unchanged.
The integration coordinator assigned a small typed-probe repair and its full compiler check to the fourth bug
worker. That worker returned `63ffc067b9c48cc4e2fc56c0138db4005f7cb1fd` and reported full typecheck, targeted lint,
and ten-case browser collection passing. This lane did not rerun that worker's checks or claim final combined
source qualification. The original observed compiler failure remains recorded.

## Evidence and handoff

- [Primary registry manifests, lockfile change inventory and validation summary](../evidence/dependency-upgrade-20261119.json).
- [Unmodified full advisory report](../evidence/npm-audit-20261119-round4.json).
- [Unmodified runtime advisory report](../evidence/npm-runtime-audit-20261119-round4.json).
- [Current dependency decision and historical context](../DEPENDENCIES.md).

The coordinator should integrate the dependency commit, install from the new lockfile, integrate the bug
worker's probe-typing repair, and qualify the exact combined tree. Full unit tests, reproducible builds,
native/browser runs and the 15-case QR matrix are centrally coordinated; this lane does not duplicate or claim
them. Keep the separate Playwright upgrade pending its unresolved Firefox qualification.

No remote mutation, workflow dispatch, deployment, release or paid API execution occurred in this lane.
