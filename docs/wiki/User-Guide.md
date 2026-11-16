# User Guide — Unaltered

[Wiki Home](Home.md) · [Developer Guide](Developer-Guide.md) · [README](https://github.com/djshellshoxxx/Unaltered/blob/main/README.md)

## What Unaltered does

Unaltered is an experimental, client-side file fingerprinting and OpenTimestamps application. It calculates a SHA-256 fingerprint locally, submits timestamp commitments to independent calendars, and downloads a standard `.ots` receipt. Later verification checks the exact file and the Bitcoin anchoring evidence. It cannot establish whether the contents are true, who made the file, or the precise creation time.

**Release status:** v0.3.1 development build, unaudited; artifacts are unsigned. No published/signed release is established by these instructions. The repository's [completion status](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/COMPLETION_STATUS.md) and [release requirements](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/RELEASE.md) govern release readiness.

## Installation or access

You may build locally using Node.js **22 or newer**, or use a separately qualified distribution from the project's release process. To build:

```sh
git clone https://github.com/djshellshoxxx/Unaltered.git
cd Unaltered
npm ci --ignore-scripts
npm run check
npm run build
```

For offline, local use open `dist/unaltered-0.3.1.html` (the single-file build). The `dist/web/` multi-file build must be served from a static web server rather than opened from `file://`. See [Release and distribution](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/RELEASE.md). Hashing can work offline after the app is loaded; stamping, upgrading, and explorer-backed verification require connectivity.

## Stamp and preserve an original

1. Open **Stamp**, select the exact file(s) you want timestamped, and review the detected type.
2. If supported metadata cleaning is enabled (JPEG/PNG, plus supported audio formats), download and retain the **cleaned file** before stamping. The receipt commits to the bytes you actually stamp, not necessarily the original before cleaning. Supported types and treatment are documented in [SPEC](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/SPEC.md).
3. Review the fingerprint and choose **Create receipt**. Save the downloaded **pending** `.ots` receipt. It is not yet Bitcoin confirmation.
4. Keep the stamped file and `.ots` receipt in at least two independent locations. Unaltered does not keep either for you.

The browser does not send the original file to the public calendars. Network services can still observe your IP address, timing and some requests. For sensitive use, read the [threat model](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/THREAT_MODEL.md).

## Verify or upgrade

In **Verify**, choose the exact stamped file and its `.ots` receipt. Treat results distinctly:

- **VERIFIED:** the file matches and the available verification evidence passed the stated checks. This is not independent full-node consensus.
- **PENDING:** receipt exists but Bitcoin confirmation has not been established. Wait and use **Upgrade**.
- **NO MATCH / INVALID PROOF / SOURCES DISAGREE / UNREACHABLE:** do not describe the file as verified.

**Upgrade** offers a new receipt download if additional proof material becomes available. Retain the old receipt as well. Independent, trusted-header/offline verification is documented in [Offline verification](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/OFFLINE_VERIFICATION.md).

## Other common workflows

- **Batch Verify:** select up to **50** originals and their matching `ORIGINAL_FILENAME.ots` files; results are per item. A batch failure must not be interpreted as confirmation for other files.
- **Receipt overview:** an optional local Settings list stores limited fingerprints/metadata, **not** receipt files or verified Bitcoin state. Losing the digital receipt cannot be repaired from the list.
- **Evidence ZIP:** the browser can export original/receipt bytes plus a manifest, with a **16 MiB combined limit**. Creating a bundle by itself is not verification.
- **QR certificates:** experimental `UNALTERED-OTS-QR/1` framing can encode the original receipt in printed QR frames. Images are representations/transports of the receipt, **not** substitutes for keeping the exact original `.ots` file. The scanner can reconstruct a receipt when every required frame is readable; subsequently verify that receipt against the stamped file. See [QR protocol](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/ARCHIVAL_QR_PROTOCOL.md).

**CLI availability:** the source on `main` now includes the CLI extensions integrated through PR #79, including inspection, batch and evidence workflows. Check `node dist/unaltered-cli-0.3.1.mjs --help` against the exact build being used; source integration does not establish a signed production release.

## Troubleshooting and FAQ

**Why is my receipt pending?** Calendar submissions are promises; Bitcoin anchoring can take time. Try Upgrade later, and preserve the downloaded receipt.

**Why does Verify report no match?** The selected file bytes differ. If metadata cleaning produced a new file, verify the cleaned copy that was stamped.

**Why can't I connect?** Public calendar/explorer availability and browser CORS policies can prevent remote checks. A network failure is not a negative timestamp verdict.

**Does the QR code prove authenticity?** No. It encodes receipt bytes. You still need the original file and independent receipt verification.

**Does timestamping make me anonymous or remove all identifying content?** No. IP/timing metadata may be visible to third-party network services. Structural metadata cleaning is format-limited and does not remove identifying content inside pixels/audio.

**Where can I report a suspected security issue?** Use the repository's [private reporting instructions](https://github.com/djshellshoxxx/Unaltered/blob/main/SECURITY.md), not a public issue.

## Website navigation and accessibility

The GitHub Pages site uses **Stamp**, **Verify**, **About** and **Settings**. The QR print/recovery tools are available in Verify. Use the keyboard-accessible navigation and native file selectors; status messages distinguish pending, verified, invalid and unreachable outcomes. If a calendar request fails, retain the original receipt and try the reference CLI instead of interpreting a network error as a negative proof.

Settings explains calendar redundancy, the minimum submission threshold, and independent Bitcoin explorer checks. Changing language should not discard active file selections or QR recovery state. The hosted site is an experimental beta; verify its footer build code against the published artifact before relying on it.
