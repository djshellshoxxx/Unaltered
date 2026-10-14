# Security Policy

## Status

Unaltered is pre-alpha. It has **not** been audited. Do not use it for anything where a failure could harm someone.

## Reporting a vulnerability

Please report privately. Do **not** open a public issue for a security problem.

Use GitHub's private vulnerability reporting for this repository (Security tab, "Report a vulnerability").
It must be enabled in the repository settings (see `docs/TODO.md`, task OPS-3).

A PGP/age contact key will be published here before the first release: `TODO(OPS-4)`.

## What we want to hear about

- Any way a file, its name, or its metadata can leave the user's device.
- Any way the app can report a false "MATCH" or hide a "NO MATCH".
- Metadata-stripping bypasses (data that survives, or files wrongly reported as clean).
- Parser crashes or memory problems on crafted files.
- Dependency or build-pipeline compromise, or a way to alter the served app.
- CSP or Trusted Types bypasses.

## Our commitments

- Acknowledge reports within 7 days.
- Fix or publish a mitigation for confirmed high-severity issues before public disclosure whenever possible.
- Credit reporters who want credit; protect those who do not.

## Supported versions

Only the latest tagged release is supported once releases exist.

## Verifying a release

Every release publishes `SHA256SUMS` and a signature over it. See `docs/OPSEC.md` section "Releases". Never use a copy of the app whose hash you have not compared against a published value.
