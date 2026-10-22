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
path or the machine: two builds, and Linux and Windows builds, are byte-identical (CI gates `build-test`, `windows`,
`reproducible-across-platforms`).

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

1. `main` is green; `docs/TODO.md` M5 items done; version bumped in `package.json`; `git tag -s v<version>`.
2. Pushing the tag (or running the workflow manually with a tag name) runs `.github/workflows/release.yml`: builds on Linux, Windows and macOS, fails if any differ, creates an unsigned **pre-release** with all artefacts.
3. A second person rebuilds locally (`npm ci --ignore-scripts && npm run build`) and compares `dist/SHA256SUMS`.
4. **Offline:** `gpg --detach-sign --armor SHA256SUMS` (or `minisign`) with the release key. Attach `SHA256SUMS.sig`. The workflow never holds the key (OPSEC 2.2).
5. Publish. Pin the same files to IPFS and record the CID in the notes. Publish the public key in the repo and two other places (OPS-4).

Not done in this repository (needs people or credentials): the release key itself, signing, IPFS pin, domain decision (Q5), independent audit (REL-3).
