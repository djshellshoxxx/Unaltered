# Threat Model

Status: draft v0.1. Review at every milestone and before any audit.
Method: assets → adversaries → threats → mitigations → **residual risk we state openly**.

## 1. Assets

| ID | Asset | Why it matters |
|---|---|---|
| A1 | The user's file (bytes, name, metadata) | May be sensitive evidence |
| A2 | The fingerprint and the receipt (`.ots`) | Integrity matters; loss is permanent |
| A3 | The user's identity and location (IP, device, time zone, habits) | Safety of people documenting wrongdoing |
| A4 | Correctness of a verification result | A false "VERIFIED" or hidden "NO MATCH" can mislead courts, editors, the public |
| A5 | Integrity of the delivered app (the JS the user runs) | Whoever controls it controls A1-A4 |
| A6 | Maintainers' identity and accounts | Compromise gives access to A5 |

## 2. Adversaries

| ID | Adversary | Capability |
|---|---|---|
| T1 | Passive network observer (ISP, Wi-Fi owner) | Sees destinations and timing |
| T2 | Calendar or explorer operator | Sees IP, timing, digest (calendars), queried block heights (explorers) |
| T3 | Compromised or coerced host, CDN, or mirror | Can alter served files |
| T4 | Malicious or compromised dependency or build tool | Runs code in the app or in CI |
| T5 | Powerful state actor | Legal compulsion of hosts, registrars, maintainers; targeted malware; traffic analysis |
| T6 | Forger | Wants to backdate a fake, or discredit a genuine file |
| T7 | Malicious file author | Crafts files to crash or exploit parsers |
| T8 | Phisher / clone-site operator | Imitates the site to harvest files or serve a tampered app |
| T9 | Local attacker (malware, shared computer) | Reads the user's screen, files, downloads |
| T10 | Careless user | Loses receipt, stamps the original instead of the cleaned copy, misreads "pending" |

## 3. Threats and mitigations

| # | Threat | Adversary | Mitigation | Residual risk |
|---|---|---|---|---|
| 1 | File uploaded or leaked by the app | T3,T4 | Client-only design; CSP `connect-src` allowlist; `net` is sole fetch caller; no third-party origins; e2e test asserts no request carries file bytes | A compromised delivered app can still exfiltrate (see 4) |
| 2 | Tampered app served to users | T3,T4,T8 | Reproducible build; signed releases; published hashes; footer shows build hash; single-file offline build users can hash and keep; SRI; no CDN; docs tell high-risk users to verify then run offline | **Browser-delivered code is inherently trust-on-first-use.** Users who do not check hashes remain exposed. Not fully solvable in-browser |
| 3 | Dependency compromise (Ledger Connect Kit pattern) | T4 | 1 runtime dependency; exact pins; lockfile review; `--ignore-scripts`; provenance checks; no `latest`, no CDN loading; Dependabot PRs reviewed by diff; maintainer 2FA with hardware key; no publishing step to a shared registry | Compromise of a pinned dependency's *upstream at the time we pin* is possible; mitigated by small surface and diff review |
| 4 | Malicious maintainer / stolen maintainer account | T4,T5,T6 | Branch protection; signed commits; required CI; release signing key offline; two-person review once there are two maintainers (bus-factor plan) | A solo maintainer is a single point of failure |
| 5 | False VERIFIED result | T6,T3 | Explorer quorum (≥2 independent); fail closed on disagreement; strict start-digest comparison; negative tests (SR-10); differential tests vs reference client; recommend L2 local-node verification | Collusion of all queried explorers; Bitcoin-level attacks (considered infeasible for confirmed, deep blocks) |
| 6 | Timestamp misunderstood as proof of truth | T6,T10 | Mandatory copy blocks; UI language "existed no later than"; About page explains forgery of content is possible | Users and audiences may still over-trust. Education, not code, is the fix |
| 7 | User stamps the original, not the cleaned copy (location leaks later) or loses the cleaned copy | T10 | Cleaned-copy download required before stamping; explicit warning; receipt is bound to cleaned copy only | User error remains possible |
| 8 | Metadata remains after stripping | T7,T10 | Allowlist rewriter; self-check re-parse; refuse malformed; "unsupported" warning for other types; documented limits | Content-level identifiers (faces, PRNU sensor noise) remain; other copies of the image elsewhere may retain metadata |
| 9 | Parser exploit or DoS via crafted file/proof | T7 | Caps on size, depth, counts; iterative parsing; fuzz/property tests; Web Worker isolation for hashing; memory-safe JS | JS engine bugs; mitigated by browser updates |
| 10 | Network observer learns the user stamped something | T1,T2 | CSP-limited destinations; guidance to use Tor/VPN; privacy nonce per reference client so calendars do not see the raw file hash **[SPIKE M0-2]** | Timing, IP and "uses Unaltered" are visible without Tor |
| 11 | Calendar/explorer downtime or removal | T2,T5 | ≥2 calendars at stamp; multiple explorers at verify; settings to add others (v0.2); proof is self-contained once upgraded; L2 verification needs no third party | Early (pending) receipts depend on calendar survival; users are told to upgrade soon |
| 12 | Hash weakness | T6 | SHA-256 only; reject SHA-1; plan for hash migration | Future cryptanalysis (low probability, long horizon) |
| 13 | Clone / look-alike site | T8 | Publish canonical hashes and IPFS CID; footer shows build hash; avoid vanity domains that are easy to typosquat (or register them defensively); documentation | Users who never check will not notice |
| 14 | Coerced takedown of host/domain | T5 | No domain required (IPFS/ENS option); mirrors; single-file offline build users can keep; repository stays public | Distribution can be harassed; the software cannot be "unreleased" |
| 15 | Legal exposure for maintainers (misuse claims, defamation by users) | T5 | The tool stores no user content, makes no claims about individuals, and has no accusation feature; ToS-free design | Cannot be fully eliminated; get legal advice before launch |
| 16 | Local malware | T9 | Out of scope; documented | Fully exposed |
| 17 | Accessibility failure causes user to misread result | T10 | Colour-independent result states; WCAG 2.2 AA | Residual usability risk (SecureDrop audits treat usability issues as security issues) |

## 4. Explicit non-protections (must be stated in user docs)

- Unaltered does not make you anonymous.
- It does not protect you from malware on your own device.
- It does not prove a file is genuine or true.
- It cannot guarantee that the website you loaded is the real one unless you check its hash.
- It does not remove identifying content from inside images (faces, places, camera sensor noise).

## 5. Review triggers

Re-run this document when: a dependency is added, a new file type is supported, an endpoint is added to the allowlist, the receipt format changes, before each audit, and after any security report.
