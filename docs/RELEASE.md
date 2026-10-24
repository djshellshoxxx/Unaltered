# Release and distribution

## What a build produces (`npm run build`)

| Artefact | Purpose |
|---|---|
| `dist/unaltered-<v>.html` | **Single-file offline build** (FR-9). Inline script/style allowed by CSP hash, no `'unsafe-inline'`. Runs from `file://`. |
| `dist/unaltered-<v>.zip` | **Windows package**: multi-file site (SRI), the single file, `Open-Unaltered.cmd`, `Verify-Checksums.ps1`. Stored, byte-reproducible. |
| `dist/unaltered-<v>-linux.tar.gz` | **Linux package**: same site/single file, `open-unaltered.sh` (xdg-open), `verify-checksums.sh` (`sha256sum -c`). Fixed mtime/owner, gzip OS byte pinned. |
| `dist/unaltered-<v>-macos.zip` | **macOS package**: same site/single file, `Open-Unaltered.command` (double-click), `verify-checksums.sh` (`shasum -a 256 -c`). Unix modes recorded in the zip. |
| `dist/unaltered-cli-<v>.mjs` | **CLI verifier** (Node >= 22): `hash <file>`, `verify <file> [receipt.ots]`; also inside every package. Exit code encodes the result state. |
| `dist/web/` | The multi-file site unpacked, for hosting. |
| `dist/SHA256SUMS` | Checksums of the offline HTML, CLI bundle, Windows and macOS ZIPs, and Linux tarball. |

The zip also contains its own `SHA256SUMS`, `README.txt`, `LICENSE`, `Open-Unaltered.cmd` (double-click launcher for Windows)
and `Verify-Checksums.ps1` (prints OK/MISMATCH per file using `Get-FileHash`). Nothing in any artefact depends on the time, the
path or the machine: two Linux builds and builds from Linux, Windows and macOS must be byte-identical (CI gates `build-test`, `windows`,
`macos`, `reproducible-across-platforms`). Normal PR CI retains all five distributable artefacts plus `SHA256SUMS` from each OS;
the comparison job checks the three checksum lists. A workflow definition is not evidence that its native runner checks passed.

## Linux and macOS

Same model as Windows (ADR-009, extended by ADR-011): no installer, no executable shipped. Linux: `tar xzf unaltered-<v>-linux.tar.gz && sh unaltered-<v>/open-unaltered.sh`.
macOS: unzip, then right-click `Open-Unaltered.command` > Open the first time (Gatekeeper quarantines downloaded scripts; the page itself is a plain HTML file and needs no approval).
Run `verify-checksums.sh` first to compare every file with the folder's `SHA256SUMS`.

## Windows

There is no installer and nothing to install; the Windows deliverable is the zip (or the single `.html`). Unzip, double-click
`Open-Unaltered.cmd`. SmartScreen does not apply because no executable is shipped. A native `.exe` wrapper (Electron/Tauri) was
deliberately **not** built: it would add a large dependency tree and an update/signing surface that the dependency policy
(NFR-2, OPSEC section 3) rejects, and the browser already provides the sandbox. Revisit only via an ADR.

## Cutting a release (maintainers)

These are future maintainer actions requiring separate authorization. The 2026-10-24 resume authorizes workflow preparation and checks only; it authorizes no release, deployment, signing-key or credential changes.

1. `main` is green on the exact intended commit; `docs/TODO.md` M5 items done; version bumped in `package.json`. Confirm all acceptance gates and human controls below before preparing a release. Create and push a signed `v<version>` tag only when authorized.
2. Explicitly dispatch `.github/workflows/release.yml`, selecting that tagged commit/ref and supplying its existing tag. The tag must exactly equal `v` plus the package version (three numeric components) and resolve to the selected commit. Branch pushes and tag pushes do not run this workflow or create releases. The validation checks tag identity and commit, not the cryptographic signer's trust; a maintainer must verify the signed tag separately.
3. The workflow builds on Linux, Windows and macOS, requires matching checksum lists, verifies the Linux artefacts, and creates an unsigned **draft pre-release** using `gh release create --verify-tag --draft --prerelease`. It never edits an existing release or overwrites assets; creation fails if the tag already has a release. A draft is preparation, not a signed public release. Do not run the dispatch under the current resume authorization.
4. A second person rebuilds the exact tagged source locally (`npm ci --ignore-scripts && npm run build`) and compares `dist/SHA256SUMS`.
5. **Offline:** `gpg --detach-sign --armor SHA256SUMS` (or `minisign`) with the dedicated release key. Attach `SHA256SUMS.sig` using the chosen signature format and publish verification instructions. The workflow never holds the key (OPSEC 2.2).
6. With separate maintainer authorization, publish only after the signed tag, independent rebuild, native CI/acceptance results, signing, and required security review are complete. Pin the same files to IPFS and record the CID in the notes. Publish the public key in the repo and two other places (OPSEC section 7).

Not done in this repository (needs people or credentials): the release key itself, signing, IPFS pin, domain decision (Q5), independent audit (REL-3).

## Remaining release controls

No automated workflow substitutes for a dedicated offline release key, its backup/recovery plan, trusted signed-tag verification, an independent rebuild, published public-key fingerprints, or a reviewed detached checksum signature. Evidence for all three native OS runners and browser/large-file acceptance must refer to the exact release commit. The independent security audit, manual accessibility review, hosting/domain decision and IPFS pin remain tracked in `docs/TODO.md`; do not describe them as complete without evidence. See [the 2026-10-24 controls handoff](RELEASE_CONTROLS_20261024.md).
