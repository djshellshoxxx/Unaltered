# Unaltered

**Prove a file existed, unchanged, at a point in time, without trusting us.**

> **Status: v0.1 feature-complete, unaudited, unsigned.** The application is implemented and tested (see [docs/AUDIT.md](docs/AUDIT.md)),
> but live network behaviour is not yet confirmed and no independent security audit or signed release exists.
> Do not rely on it for anything important until a tagged, signed release exists. For important cases verify with your own Bitcoin node.

## What it does

1. **Stamp:** you pick a file. Your browser computes its SHA-256 fingerprint locally. The file never leaves your device. Only a fingerprint is sent to public OpenTimestamps calendar servers, which anchor it in the Bitcoin blockchain.
2. **Keep the receipt:** you download a standard `.ots` proof file. It is the only copy. We keep no accounts and no files.
3. **Verify:** anyone with the original file and the receipt can check that the file matches and see the Bitcoin block that anchors it.

## What it proves, and what it does not

| Proves | Does **not** prove |
|---|---|
| This exact file (to the byte) existed **before** the anchoring Bitcoin block's time | That the file's contents are true or authentic |
| The file has not been changed since stamping | Who created the file |
| | The exact time (block times are only accurate to roughly a couple of hours) |
| | That you are anonymous when you stamp (your IP address is visible to the servers you contact) |

## Run it

```
npm ci --ignore-scripts
npm run check        # opsec check, typecheck, lint, unit/property/fuzz tests
npm run test:e2e     # builds, then Chromium end-to-end + accessibility tests
npm run build        # dist/: single-file offline HTML, multi-file site, zip, SHA256SUMS
```

**Windows:** unzip `unaltered-<version>.zip` and double-click `Open-Unaltered.cmd` (no install). See [docs/RELEASE.md](docs/RELEASE.md).

## Documents

| Document | Purpose |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | Product and technical specification (start here) |
| [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) | Who we defend against, and what we cannot defend |
| [docs/OPSEC.md](docs/OPSEC.md) | Rules for writing, building, and releasing the code safely |
| [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) | Vetted components and what to avoid |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architecture decision records |
| [docs/RESEARCH.md](docs/RESEARCH.md) | Research on prior art, audits, and historical failures, with sources |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | Milestones, estimates, risks |
| [docs/TODO.md](docs/TODO.md) | Actionable task checklist |
| [docs/AUDIT.md](docs/AUDIT.md) | Feature and code audit against the spec |
| [docs/NETWORK.md](docs/NETWORK.md) | Calendar and explorer API facts, live-check status |
| [docs/UX.md](docs/UX.md) | Screens and mandatory copy |
| [docs/RELEASE.md](docs/RELEASE.md) | Build artefacts, Windows distribution, release procedure |
| [SECURITY.md](SECURITY.md) | How to report vulnerabilities |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution rules (dependencies and security are strict) |

## Principles

- **Client-only.** No backend, no database, no accounts, no analytics.
- **Standard formats.** Receipts are ordinary OpenTimestamps `.ots` files, verifiable with independent tools.
- **Never the only verifier.** The app tells users how to verify without us.
- **Fail closed.** If something is unsupported or ambiguous, we refuse and say so. We never silently pass.
- **Few, audited dependencies.** Every runtime dependency needs a written justification.

## Licence

MIT. See [LICENSE](LICENSE).
