# Threat Model

Status: internal review refreshed 2026-10-24 for v0.3.1 (REL-1); independent audit remains open. Review at every milestone and before any audit.
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

## 6. Current internal review — 2026-10-24

Scope: source `1453865ca21a5c8a98b92805a36799de44d97919` (PR #6). The earlier table records the design threat model, including intended operational controls; it does not certify that branch protection, account hardware keys, signing, independent review or public distribution controls are configured. This is an internal refresh of the implemented scope and known gaps, not independent security acceptance.

| Threats | Current implementation / evidence | Residual risk and boundary |
|---|---|---|
| 1–4, 13–14: delivery and dependency compromise | Client-only architecture, one exact-pinned runtime dependency, pinned CI actions, ignored install scripts, three-OS checksum agreement and package signatures/provenance checks. The unsafe branch-triggered unsigned publication path is replaced with manual dispatch of an existing exact-version tag at the selected commit and `--verify-tag --draft --prerelease`. | No release was created. Draft preparation does not sign artefacts or establish trustworthy delivery. Offline key management, signed-tag trust, independent rebuild, public-key publication, release approval and hosting/IPFS decisions remain human controls. Operational settings are not attested by this document. |
| 5, 10–11: proof correctness and service availability | Nonced commitments and explorer-header integrity checks remain. Native browser probe [run 40104783971](https://github.com/djshellshoxxx/Unaltered/actions/runs/40104783971): Alice/Finney submission POST 200; pending GETs failed browser reads; Node diagnostic found missing ACAO on pending 404s; Bob timed out; both explorers passed genesis-header integrity checks. | **R1 remains open.** Submission and genesis checks do not demonstrate a confirmed calendar upgrade or confirmed receipt verification through the app/reference client. No relay, security bypass or new service is introduced. See `NETWORK.md`. |
| 7–9: metadata privacy and parser resource use | JPEG/PNG/WAV/MP3 allowlist/container handling; structural checks and audio self-check; malformed/unsupported outcomes are distinct. Expanded bounded property/mutation and truncation/resource tests cover the in-house parsers. | Stripping reads supported inputs into memory with a 256 MiB input cap; this is not a streaming-memory guarantee. It cannot erase identifying pixels/samples, steganography, watermarks or MP3 frame/Xing payloads; unsupported types (including PDF stripping) remain warnings, not sanitized output. Synthetic audio fixtures do not establish decoded fidelity or real-encoder interoperability. See `PARSER_ACCEPTANCE_20261024.md`. |
| 9: large-file hashing and I/O correctness | Actual Blob hashing uses bounded 4 MiB reads with BYOB reuse where supported; fallback slices remain. Safe integer sizes/chunk sizes and exact slice lengths are checked; premature stream EOF is rejected. WebCrypto cross-check applies only at ≤64 MiB, retaining its one-shot input buffer while backend reads are bounded. | Bounds apply to the hashing read path, not every cleaner, JS engine, arbitrary custom stream or application allocation. Integrating-worker evidence: all 126 unit tests passed with large-input/reference checks enabled; local real 2 GiB browser hashing passed the unchanged <200 MiB extra renderer-RSS gate in about 44 s. Native CI memory acceptance was pending at this snapshot. Neither result is a universal resource bound. |
| 17: result usability and accessibility | Integrating-worker evidence: 19 app tests passed per Chromium/Firefox/WebKit, including existing automated accessibility/CSP checks, on current native CI [run 40105518156](https://github.com/djshellshoxxx/Unaltered/actions/runs/40105518156). | Automated checks do not close manual keyboard/screen-reader review or establish WCAG conformance on every browser/device. |

All explicit non-protections in section 4 remain. The current audio support additionally does not remove identifying voices or recording content. Long coverage-guided fuzzing, provenance-recorded real-media corpus/decoded comparisons, confirmed live upgrade/reference coverage, manual accessibility and independent security audit remain open; the dated refresh closes only the internal documentation review scope. See [review record](REVIEW_REFRESH_20261024.md), `TODO.md` and `RELEASE.md` for release controls.
