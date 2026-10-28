# Internal threat/dependency review refresh — 2026-10-24

REL-1 scope: refreshed `DEPENDENCIES.md` and `THREAT_MODEL.md` for v0.3.1 source `1453865ca21a5c8a98b92805a36799de44d97919`, [PR #6](https://github.com/djshellshoxxx/Unaltered/pull/6). Historical research tables/adoption records remain intact and are distinguished from this current snapshot. This is an internal documentation review; it neither completes REL-3 nor establishes security/release readiness.

## Reviewed locally

- Manifest and lockfile pins, runtime package metadata and `sha2.js` production import; manifest/lockfile unchanged from `e4d80b67d145e940b0458bad93cc069412b39306`. Lockfile SHA-256: `cd4546fa88716387db8fe8920777c9dc992f0c9efb343d311a3f0057028f287f`.
- Hashing implementation and regression-test scope: bounded Blob reads/BYOB, slice fallback, invalid-size/read-length/EOF rejection and ≤64 MiB WebCrypto cross-check allocation boundary.
- Metadata dispatcher and parser acceptance record: JPEG/PNG/WAV/MP3, 256 MiB buffered-input cap, structural handling and explicit limits on content sanitization, synthetic-fixture fidelity and fuzzing coverage.
- Release controls and native network observations: manual unsigned draft preparation only; pending-calendar browser CORS/availability failure and missing confirmed-upgrade evidence remain open.

No dependency, source, workflow, artwork descriptor or license was changed by this refresh. No external research, new vulnerability scan or independently audited-source comparison was performed. No release, deployment, credential or repository security-setting mutation was performed.

## Integration evidence recorded, not independently rerun here

The integrating worker supplied native [CI run 40105518156](https://github.com/djshellshoxxx/Unaltered/actions/runs/40105518156): Linux/Windows/macOS builds/tests and checksum identity passed; package signature/provenance verification passed with 141 signatures and 59 attestations; each native Chromium/Firefox/WebKit app suite passed 19 tests. The native 2 GiB memory job was pending when this snapshot was written.

The integrating worker also supplied all 126 unit tests passing with large-input/reference checks enabled, and a local real 2 GiB browser test passing the unchanged <200 MiB extra renderer-RSS gate in about 44 seconds. No test thresholds or skip logic were changed by this review worker.

Native actual-browser network evidence is separately retained in [NETWORK.md](NETWORK.md), with [run 40104783971](https://github.com/djshellshoxxx/Unaltered/actions/runs/40104783971): Alice/Finney POST 200; pending reads failed, with missing ACAO observed by Node; Bob timed out; explorer genesis-header checks passed. No confirmed upgrade was established.

## Documentation checks and remaining work

Local checks passed: exact manifest/lockfile agreement for all 11 direct dependency pins; runtime package has no runtime dependencies; package files unchanged from resume baseline; historical text retained except the explicitly replaced review-status sentences; local Markdown document links resolve; `git diff --check` for the three owned docs.

REL-1's internal record refresh is complete within this bounded scope. Remaining controls: native-memory result integration, R1/confirmed calendar upgrade and reference verification, long coverage-guided fuzzing, real-media corpus/decoded comparisons, manual accessibility review, independent security audit, offline signing/key publication, independent rebuild and authorized hosting/publication. These require their own evidence; package signatures, checksum identity and this review cannot substitute for them.
