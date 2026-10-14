# Unaltered

**Prove a file existed, unchanged, at a point in time, without trusting us.**

> **Status: pre-alpha, specification phase.** There is no working application yet.
> Do not rely on this project for anything until a tagged, signed release exists.

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
