# Release and distribution

Current November 5 implementation, local qualification and remaining external gates: [autonomous checkpoint](handoff/AUTONOMOUS-DEVELOPMENT-LATEST.md). Older dated records below remain historical; production publication is not authorized by local test results.

## What a build produces (`npm run build`)

| Artefact | Purpose |
|---|---|
| `dist/unaltered-<v>.html` | **Single-file offline build** (FR-9). Inline script/style allowed by CSP hash, no `'unsafe-inline'`. Runs from `file://`. |
| `dist/unaltered-<v>.zip` | **Windows package**: multi-file site (SRI), the single file, `Open-Unaltered.cmd`, `Verify-Checksums.ps1`. Stored, byte-reproducible. |
| `dist/unaltered-<v>-linux.tar.gz` | **Linux package**: same site/single file, `open-unaltered.sh` (xdg-open), `verify-checksums.sh` (`sha256sum -c`). Fixed mtime/owner, gzip OS byte pinned. |
| `dist/unaltered-<v>-macos.zip` | **macOS package**: same site/single file, `Open-Unaltered.command` (double-click), `verify-checksums.sh` (`shasum -a 256 -c`). Unix modes recorded in the zip. |
| `dist/unaltered-cli-<v>.mjs` | **CLI verifier** (Node >= 22): `hash`, `verify`, `batch`, offline `inspect`, `evidence` ZIP export, and explicit `verify-offline` trusted-header comparison ([CLI reference](CLI.md), [offline guide](OFFLINE_VERIFICATION.md)); also inside every package. Exit code encodes the result state. |
| `dist/web/` | The multi-file site unpacked, for hosting. It needs a web server: opened from disk, browsers refuse its SRI-checked script and stylesheet (SR-3), so the packages' `README.txt` points local users to the single file. |
| `dist/SHA256SUMS` | Checksums of the offline HTML, CLI bundle, Windows and macOS ZIPs, and Linux tarball. |
| `dist/RELEASE-NOTES.md` | Draft release notes: the footer build code next to the `SHA256SUMS` lines, so the comparison the app's footer and About page ask for has a published value (SPEC 13). Not a release asset. The build code covers the bundles, stylesheet, page template and both CSPs. |

The zip also contains its own `SHA256SUMS`, `README.txt`, `LICENSE`, `Open-Unaltered.cmd` (double-click launcher for Windows)
and `Verify-Checksums.ps1` (prints OK/MISMATCH per file against the zip's own `SHA256SUMS`, using `Get-FileHash`). Nothing in any artefact depends on the time, the
path or the machine: two Linux builds and builds from Linux, Windows and macOS must be byte-identical (CI gates `build-test`, `windows`,
`macos`, `reproducible-across-platforms`). Normal PR CI retains all five distributable artefacts plus `SHA256SUMS` from each OS;
the comparison job checks the three checksum lists. A workflow definition is not evidence that its native runner checks passed.

The build normalizes text inputs to LF before hashing and packaging. This keeps an offline page's inline stylesheet
consistent with HTML newline preprocessing and its CSP hash, including source copies with CRLF or lone-CR endings.
Package tests compare all generated files across those input forms and allow only the declared runtime and distribution
files; the bundled research/agent toolkit is excluded.

## Local rebuild evidence (2026-11-05)

Source `210e3df8e05220d65fc7fa31cc78a8d3a5b3102a` was rebuilt in the separate checkout
`.development/release-independent-20261105`, first with
`/usr/local/share/nvm/versions/node/v22.23.4/bin/node` (22.23.4), then with
`/usr/local/share/nvm/versions/node/v24.22.2/bin/node` (24.22.2). Both Linux builds produced build code
`2969d158f4936bfd`. All ten generated files matched each other and the captured
`.development/consolidation-20261104/dist` baseline byte for byte; all five published checksum entries passed
`sha256sum -c SHA256SUMS`. The complete matching manifest is:

```text
6a3a66e6e473852a84dc6499080accdb3039100467d910b2002ac0713b245409  RELEASE-NOTES.md
651f38a9c826527a44595e6f6fb6a4f505c766c5cab18b01c1c14753217b0b9e  SHA256SUMS
680b530420a9abf32b04d1d9d31cd9cfbdd89a06debf99d72e6c7ad0fb527fa3  unaltered-0.3.1-linux.tar.gz
65fc5922cad4fd077b5dabea99c03a002b97f8d61c0a880dd17525a670f7e259  unaltered-0.3.1-macos.zip
86a35c926509baf489278933bbd7d2fa91a9800b38b435e2b11c533660738e5e  unaltered-0.3.1.html
4d48d029933161ed611b55d929b1d46531eb8f85d5ad8241db51fc7c1052afb9  unaltered-0.3.1.zip
ca74be05617b86b3e7a9145a9206281a345800cb210d6f96c0dbf830d47e8ef0  unaltered-cli-0.3.1.mjs
4f2cc36eccf9845f1c31ab35e2ab8a5ac94c67d3d1a2a62ccfe7ecc7fff4c14e  web/index.html
39b1a18e3d2bfd56619381cdc777f51d47061534aff45384b40cc46f76d48ca2  web/main.js
a6615aedfd8aa0549a9d01c462ddefc2548d3908b9c306e8b0e232cad756d161  web/styles.css
```

These builds used the existing installed dependencies without modifying the shared dependency tree; no fresh
dependency installation was performed. This establishes reproducibility across separate checkout paths and these
two Node versions on one Linux environment. Independent human approval and native Windows/macOS results remain
separate release gates. No signing keys or signatures were created, and no release was dispatched or published.

## Linux and macOS

Same model as Windows (ADR-009, extended by ADR-011): no installer, no executable shipped. Linux: `tar xzf unaltered-<v>-linux.tar.gz && sh unaltered-<v>/open-unaltered.sh`.
macOS: unzip, then right-click `Open-Unaltered.command` > Open the first time (Gatekeeper quarantines downloaded scripts; the page itself is a plain HTML file and needs no approval).
Run `verify-checksums.sh` first to compare every file with the folder's `SHA256SUMS`.

The in-package helpers (`Verify-Checksums.ps1`, `verify-checksums.sh`) only check a folder against the `SHA256SUMS` inside
the same archive. That finds damaged or incomplete copies, not tampering: anyone who changes a package can regenerate
that list. A copy is shown to be genuine only by checking the downloaded archive (or the single `.html`) against the
published `SHA256SUMS` and its signature. Each package `README.txt` says so and names the archive to check, and the
helpers print the same reminder after a match.

Checksum helpers fail closed when `SHA256SUMS` is missing, empty or malformed. Linux and macOS helpers use the checksum
tool's strict parsing mode; a valid entry alongside a malformed line is still an error. The Windows helper also rejects
duplicate entries and names that point outside the flat package directory, uses literal paths and requires at least one
checked entry. Its interactive verdict remains printed text, so native CI checks that verdict rather than assuming that
the PowerShell process exit code certifies success. A self-consistent list still establishes integrity only, not authenticity.

## Windows

There is no installer and nothing to install; the Windows deliverable is the zip (or the single `.html`). Unzip, double-click
`Open-Unaltered.cmd`. SmartScreen does not apply because no executable is shipped. A native `.exe` wrapper (Electron/Tauri) was
deliberately **not** built: it would add a large dependency tree and an update/signing surface that the dependency policy
(NFR-2, OPSEC section 3) rejects, and the browser already provides the sandbox. Revisit only via an ADR.

## Cutting a release (maintainers)

These are future maintainer actions requiring separate authorization. The 2026-10-24 resume authorizes workflow preparation and checks only; it authorizes no release, deployment, signing-key or credential changes.

1. `main` is green on the exact intended commit; `docs/TODO.md` M5 items done; version bumped in `package.json`. Confirm all acceptance gates and human controls below before preparing a release. Create and push a signed `v<version>` tag only when authorized.
2. Explicitly dispatch `.github/workflows/release.yml`, selecting that tagged commit/ref and supplying its existing tag. The tag must exactly equal `v` plus the package version (three numeric components) and resolve to the selected commit. Branch pushes and tag pushes do not run this workflow or create releases. The validation checks tag identity and commit, not the cryptographic signer's trust; a maintainer must verify the signed tag separately.
3. The workflow builds on Linux, Windows and macOS, requires matching checksum lists and release notes, verifies the actual downloaded artefacts against `SHA256SUMS` in **each platform's directory**, and creates an unsigned **draft pre-release** using `gh release create --verify-tag --draft --prerelease`, with the build's `RELEASE-NOTES.md` as its notes. It never edits an existing release or overwrites assets; creation fails if the tag already has a release. A draft is preparation, not a signed public release. Do not run the dispatch under the current resume authorization.
4. A second person rebuilds the exact tagged source locally (`npm ci --ignore-scripts && npm run build`) and compares `dist/SHA256SUMS`.
5. **Offline:** `gpg --detach-sign --armor --output SHA256SUMS.sig SHA256SUMS` (or `minisign`) with the dedicated release key. The [explicit GPG output name](https://www.gnupg.org/documentation/manuals/gnupg/GPG-Input-and-Output.html) matches the signature asset expected by these instructions. Attach `SHA256SUMS.sig` using the chosen signature format and publish verification instructions. The workflow never holds the key (OPSEC 2.2).
6. With separate maintainer authorization, publish only after the signed tag, independent rebuild, native CI/acceptance results, signing, and required security review are complete. Pin the same files to IPFS and record the CID in the notes. Publish the public key in the repo and two other places (OPSEC section 7).

Not done in this repository (needs people or credentials): the release key itself, signing, IPFS pin, domain decision (Q5), independent audit (REL-3).

## Remaining release controls

No automated workflow substitutes for a dedicated offline release key, its backup/recovery plan, trusted signed-tag verification, an independent rebuild, published public-key fingerprints, or a reviewed detached checksum signature. Evidence for all three native OS runners and browser/large-file acceptance must refer to the exact release commit. The independent security audit, manual accessibility review, hosting/domain decision and IPFS pin remain tracked in `docs/TODO.md`; do not describe them as complete without evidence. See [the 2026-10-24 controls handoff](RELEASE_CONTROLS_20261024.md).
