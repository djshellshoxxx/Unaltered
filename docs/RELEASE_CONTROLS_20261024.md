# Release controls handoff — 2026-10-24

Scope: v0.3.1 workflow preparation on `codex/resume-acceptance-20261024`, resumed from `e4d80b67d145e940b0458bad93cc069412b39306`. No release, deployment, tag, credential or repository security-setting mutation was performed. The app remains client-only.

## Implemented controls

- `.github/workflows/release.yml` accepts only explicit `workflow_dispatch`. Branch pushes and tag pushes cannot invoke release creation.
- A read-only validation job requires an existing exact `v<major>.<minor>.<patch>` tag matching `package.json` and resolving to the selected workflow commit. Inputs are passed through environment variables, validated before use, and never inserted into executable script text. Prerelease suffixes and arbitrary tag names are deliberately rejected.
- All three release builders (Linux, Windows, macOS), typecheck/lint/unit gates, checksum-list agreement and Linux artefact verification remain required. Missing release artefacts fail upload.
- Only the final draft job receives `contents: write`. Its sole release command is `gh release create --verify-tag --draft --prerelease`; it neither creates a missing tag nor edits or overwrites an existing release. Duplicate release creation fails. Signing keys are absent from this workflow.
- Ordinary CI now builds/tests on macOS, verifies macOS artefact checksums, retains its five distributable artefacts and checksum list, and compares Linux, Windows and macOS checksum lists. Linux and Windows uploads now also include the CLI and Linux archive. Existing browser, memory, differential, provenance and reproducibility gates are preserved.
- `docs/RELEASE.md` now distinguishes draft preparation from separately authorized signing and publication.

## Local evidence

Run on 2026-10-24:

| Check | Result |
|---|---|
| Python/PyYAML 6.0.3 `BaseLoader` parse of both workflows | Passed; `on` and `jobs` present. `BaseLoader` avoids YAML 1.1 converting `on` into a boolean. |
| `bash -n` on all default/Bash run blocks | Passed: 9 release blocks and 34 CI blocks; the existing PowerShell block is excluded. |
| Structural assertions | Passed: dispatch-only trigger; release matrix contains all three OSes; dispatch guard on draft job; only one create command, required `--verify-tag`, `--draft`, `--prerelease`, no edit/upload/clobber; CI comparison needs all three builders; memory gate still sets `UNALTERED_BIG_BROWSER=1`. |
| Executing the actual tag-validation shell with isolated local `git`/`node` fixtures | Passed 10 cases: existing version accepted; missing tag, wrong commit, wrong version, empty input, option input, prerelease suffix, newline/output injection, shell interpolation and ref/path input rejected. Rejections wrote no job output; shell interpolation created no file. No real tags or commits were created. |
| `git diff --check` | Passed after workflow/document edits. |

`actionlint` is not installed in this environment. YAML parsing, shell syntax and local fixtures do not establish GitHub Actions service execution or native runner success. This worker did not rebuild shared `dist` while browser acceptance used it; the integrating worker owns the full local build/test evidence.

## Exact remaining controls before publication

1. Merge/commit review and hosted CI evidence for the exact candidate: Linux, Windows and macOS tests/builds and matching checksums; required Chromium/Firefox/WebKit, CSP/accessibility, large-file browser memory, differential and provenance checks. Hosted workflow execution was not triggered by this worker.
2. Human signed-tag verification and trusted signer verification. The workflow checks the tag's commit and version, not signer trust or a cryptographic signature. Tag creation/push and draft dispatch each require authorization beyond the current resume.
3. An independent person rebuilds the exact candidate and compares checksums. No such independent rebuild is claimed here.
4. A dedicated offline release-signing key with backup/recovery plan; detached `SHA256SUMS` signature reviewed and attached; public key and verification instructions published in the repository and two independent places. No key material or credentials were provisioned.
5. Complete required manual accessibility/security review and resolve applicable M5/audit gates in `docs/TODO.md`, with evidence. Select hosting/domain and IPFS pin policy, retain a CID when pinning, and obtain separate authorization for publication/deployment. No audit, hosting, IPFS pin or deployment is claimed here.

The draft workflow is prepared but has not run. No release is authorized by this handoff, and no signed or public release readiness is claimed.
