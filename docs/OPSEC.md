# Developer Operational Security (OPSEC)

Rules for writing, building, and releasing Unaltered safely. Each rule exists because a real project failed this way; see `RESEARCH.md` for sources.
Mark rules **[MUST]**, **[SHOULD]**.

## 1. Identity and metadata hygiene

Decide now whether maintainers are pseudonymous. If yes, decide **before the first commit**; history, forks, caches, and web archives cannot be fully scrubbed later.

1. **[MUST]** Use a dedicated git identity for this repo only (`git config user.name/email` locally, never `--global`), preferably the GitHub `noreply` address.
2. **[MUST]** Run `scripts/opsec-check.sh` before every push (also run in CI). It flags personal emails, home-directory paths, and image metadata in tracked files.
3. **[SHOULD]** Make commit timestamps non-revealing: commit in UTC (`TZ=UTC`) and avoid patterns that reveal working hours.
4. **[MUST]** Keep personal names out of `package.json` (`author`), `LICENSE` (we use "The Unaltered contributors"), docs, test fixtures, and commit messages.
5. **[MUST]** Strip metadata from every image, PDF, and document fixture before committing; use synthetic fixtures only.
6. **[SHOULD]** Do pseudonymous work from a separate OS user, VM, or device and browser profile; never log in to personal accounts there.
7. **[SHOULD]** Do not reuse writing style, handles, or wallet addresses linked to your real identity.
8. **Reality check:** anonymity of authorship is separate from this project's goals. If maintainers want it, treat it as its own workstream with its own review.

## 2. Accounts and keys

1. **[MUST]** Hardware security key (FIDO2) 2FA on GitHub and any registrar or hosting account; no SMS 2FA.
2. **[MUST]** Separate **release-signing key** from the day-to-day commit-signing key. Keep the release key offline (hardware key or air-gapped storage), with an encrypted backup and a written recovery plan.
3. **[MUST]** Sign all commits and tags. Require signed commits via branch protection.
4. **[MUST]** Offboarding checklist when any contributor leaves: remove repo access, revoke tokens/keys, rotate shared secrets. (Ledger's 2023 Connect Kit compromise began with a **former employee's** account still able to publish.)
5. **[MUST]** No long-lived tokens in CI. Prefer OIDC/trusted publishing; scope any token to a single repo and minimum permission.
6. **[SHOULD]** Use a password manager; unique passwords everywhere; review active sessions and tokens monthly (session-token theft bypasses passwords).

## 3. Dependencies and supply chain

1. **[MUST]** Runtime dependencies: only those marked Approved in `DEPENDENCIES.md`. Every addition needs an ADR.
2. **[MUST]** Exact versions (`save-exact=true`), committed `package-lock.json`, and `npm ci --ignore-scripts` everywhere (local, CI, release). `.npmrc` enforces `ignore-scripts=true`.
3. **[MUST]** Review the lockfile diff of every dependency PR, including transitive additions and changed integrity hashes. Dependabot only *proposes*.
4. **[MUST]** Never load code from a CDN or `@latest` URL. Everything shipped is built from pinned local sources and covered by SRI/CSP hashes.
5. **[SHOULD]** Verify package provenance where offered (`npm audit signatures`) and prefer packages that publish via CI with provenance and signed commits.
6. **[SHOULD]** Delay adoption of brand-new releases of any dependency by a cooldown (e.g., 7 days) so malicious versions are more likely to be caught and yanked.
7. **[MUST]** Before upgrading any dependency, compare against the last reviewed version; record the reviewed version and date in `DEPENDENCIES.md`.
8. **[SHOULD]** Keep dev tooling minimal; each dev dependency is still code that runs on the build machine.

## 4. Writing the code

1. **[MUST]** Follow `CONTRIBUTING.md` ground rules (no `eval`, `innerHTML`, inline handlers, third-party origins).
2. **[MUST]** Treat every file and proof as hostile input: size caps, depth caps, bounds checks before allocation, iterative parsing.
3. **[MUST]** Fail closed: unknown tag, unsupported type, source disagreement → refuse with a clear message.
4. **[MUST]** Never log user data, file names, or digests. No telemetry. No error reporting service.
5. **[MUST]** Do not implement cryptography ourselves. Use `@noble/hashes` (audited) and the browser's WebCrypto. The only things we implement are file-format parsers and policy logic, and those get fuzzed.
6. **[SHOULD]** Keep functions small and pure; keep `fetch` in exactly one module; keep DOM writes in the UI layer.
7. **[SHOULD]** Randomness: only `crypto.getRandomValues`. Never `Math.random()` (a well-known early failure class in browser crypto code).
8. **[SHOULD]** Second pair of eyes: no change to `core/net`, `core/ots`, `core/strip`, or `scripts/build.mjs` merges without independent review once a second maintainer exists; until then, self-review against the checklist in the PR template and delay merges by 24 h.

## 5. CI/CD hardening

1. **[MUST]** Workflows declare `permissions: contents: read` by default; elevate per job only when needed.
2. **[MUST]** Pin third-party GitHub Actions by full commit SHA (not tags), with a comment naming the version. (`TODO CI-2`: the initial workflow uses version tags only because SHAs were not verified while writing; replace before the first release.)
3. **[MUST]** Never use `pull_request_target` with checkout of untrusted code. No secrets exposed to forked PRs.
4. **[MUST]** Run secret scanning (e.g., gitleaks) in CI and as push protection on GitHub.
5. **[SHOULD]** Build twice in CI and compare hashes (reproducibility gate).
6. **[SHOULD]** Pin the Node version in CI and in `engines`.

## 6. Releases

1. **[MUST]** Tag → CI builds artefacts → produce `SHA256SUMS` → sign with the offline release key → publish with instructions.
2. **[MUST]** Publish the release public key in the repo and in at least two independent places.
3. **[MUST]** Never "hot-fix in production": any change to the served app is a new, signed, hashed release.
4. **[SHOULD]** Pin an IPFS CID per release and list it in the release notes.
5. **[SHOULD]** Maintain a short public changelog of security-relevant changes.

## 7. Operating the hosting

1. **[SHOULD]** Prefer static hosting with no logs, or IPFS pinning; avoid analytics at every layer.
2. **[SHOULD]** If a custom domain is used, enable DNSSEC and registrar lock, use hardware-key 2FA, and register obvious typo variants defensively. A domain is a takedown and phishing target (Q5 in SPEC).
3. **[MUST]** Serve security headers where the host allows (CSP, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` denying camera/mic/geolocation, `Cross-Origin-Opener-Policy: same-origin`).

## 8. Audits and disclosure

1. **[SHOULD]** Commission an independent security audit before calling anything "1.0", and use a **different** firm for each later major release (the SecureDrop project's stated practice).
2. **[MUST]** Publish audit reports in full, including unfixed findings.
3. **[MUST]** Run a private vulnerability-reporting channel (`SECURITY.md`).
4. **[SHOULD]** Treat usability findings (confusing warnings, misleading result states) as security bugs.

## 9. Pre-push checklist (copy into the PR template)

- [ ] `./scripts/opsec-check.sh` passes
- [ ] No new runtime dependency (or ADR linked)
- [ ] No new network host (or allowlist + CSP + SPEC updated)
- [ ] Negative tests added for any code that can produce VERIFIED
- [ ] No personal paths/emails/names in diff
- [ ] Commits signed, identity is the project identity
