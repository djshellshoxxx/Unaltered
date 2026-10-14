# Release and distribution

## What a build produces (`npm run build`)

| Artefact | Purpose |
|---|---|
| `dist/unaltered-<v>.html` | **Single-file offline build** (FR-9). Inline script/style allowed by CSP hash, no `'unsafe-inline'`. Runs from `file://`. |
| `dist/unaltered-<v>.zip` | Multi-file site (SRI on script and stylesheet) **plus the single file plus Windows helpers**. Stored without compression so it is byte-reproducible. |
| `dist/web/` | The multi-file site unpacked, for hosting. |
| `dist/SHA256SUMS` | Checksums of the `.html` and `.zip`. |

The zip also contains its own `SHA256SUMS`, `README.txt`, `LICENSE`, `Open-Unaltered.cmd` (double-click launcher for Windows)
and `Verify-Checksums.ps1` (prints OK/MISMATCH per file using `Get-FileHash`). Nothing in any artefact depends on the time, the
path or the machine: two builds, and Linux and Windows builds, are byte-identical (CI gates `build-test`, `windows`,
`reproducible-across-platforms`).

## Windows

There is no installer and nothing to install; the Windows deliverable is the zip (or the single `.html`). Unzip, double-click
`Open-Unaltered.cmd`. SmartScreen does not apply because no executable is shipped. A native `.exe` wrapper (Electron/Tauri) was
deliberately **not** built: it would add a large dependency tree and an update/signing surface that the dependency policy
(NFR-2, OPSEC section 3) rejects, and the browser already provides the sandbox. Revisit only via an ADR.

## Cutting a release (maintainers)

1. `main` is green; `docs/TODO.md` M5 items done; version bumped in `package.json`; `git tag -s v<version>`.
2. Pushing the tag runs `.github/workflows/release.yml`: builds on Linux and Windows, fails if they differ, creates a **draft** release with unsigned artefacts.
3. A second person rebuilds locally (`npm ci --ignore-scripts && npm run build`) and compares `dist/SHA256SUMS`.
4. **Offline:** `gpg --detach-sign --armor SHA256SUMS` (or `minisign`) with the release key. Attach `SHA256SUMS.sig`. The workflow never holds the key (OPSEC 2.2).
5. Publish. Pin the same files to IPFS and record the CID in the notes. Publish the public key in the repo and two other places (OPS-4).

Not done in this repository (needs people or credentials): the release key itself, signing, IPFS pin, domain decision (Q5), independent audit (REL-3).
