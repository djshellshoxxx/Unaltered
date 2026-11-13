# GitHub Pages release automation

The manual `pages-readiness.yml` workflow is **artifact preparation only**, not publication. It builds the static site, runs the existing project-path and offline hashing browser acceptance, and uploads a review artifact and a GitHub Pages-format artifact. The existing strict readiness and deployment-template contracts remain unchanged. For an additional independent reproducibility audit, build the same source twice in separate directories and run `node scripts/compare-pages-builds.mjs FIRST/dist/web SECOND/dist/web`; this fails on missing, extra, or byte-different files and prints SHA-256 evidence. Record the exact source commit alongside that output.

## Release operator procedure
1. Verify final-head CI, QR qualification, source review, and the release requirements applicable to the intended beta.
2. Merge the reviewed PR to `main`; do not publish a PR artifact as if it were a main build.
3. Manually run **Pages readiness artifact** on `main`, and verify its recorded source SHA is the intended main head.
4. Use the separately authorized Pages publication workflow and the qualified artifact from that exact SHA. The readiness workflow has no deployment permissions.
5. Inspect the live site, compare its footer build code and assets against the qualified build, and smoke-test Stamp, Verify, QR recovery, language switching, and offline behavior.
6. On a regression, restore the last qualified Pages artifact using the authorized publication process; record the rollback SHA and incident.

Do not treat an artifact upload, workflow start, or merge as proof of deployment. Require a completed successful deployment and live-site verification.
