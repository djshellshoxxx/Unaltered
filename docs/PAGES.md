# GitHub Pages preparation

Unaltered builds to a static site in `dist/web/`. Serve that directory as a unit. It requires no Node runtime or server
application after building. JavaScript and CSS references are relative, navigation uses URL fragments, and the hash
worker runs from source pinned within the page script. The site therefore supports the repository project path
`/Unaltered/` as well as a domain root. Preserve the trailing slash on a directory URL.

The **Pages readiness artifact** workflow is manual (`workflow_dispatch`). Select the candidate branch in Actions. It
installs locked dependencies with lifecycle scripts disabled, runs `npm run check`, builds, and runs the Chromium
project-path/offline test with zero retries. Only successful gates permit either upload. Both artifacts expire after
seven days:

- `unaltered-pages-review`: a downloadable review copy whose contents are the site root.
- `github-pages`: the official Pages deployment-format artifact, containing `artifact.tar` with the same site root.
  GitHub's artifact service handles compression; this is the artifact format consumed by `actions/deploy-pages`.

The workflow grants only `contents: read` and has no deployment job. Uploading the Pages-format artifact does not publish
the site, configure GitHub Pages, change repository settings or create a release. No Pages write or OIDC permission is
granted, and `actions/configure-pages` is not invoked. A completed readiness run is evidence for that selected commit;
it does not satisfy the remaining release gates.

For local preparation, use Node 22 or newer, `npm ci --ignore-scripts`, `npm run check`, and `npm run build`. With the pinned
Playwright Chromium installed, run:

```sh
node_modules/.bin/playwright test tests/e2e/pages-base-path.spec.ts --retries=0
```

The browser test serves the site under `/Unaltered/`, checks relative asset loading and fragment navigation, and hashes a
synthetic file offline after the page loads. It requires a real worker completion with the expected byte count and SHA-256.
Offline here means an already loaded page can hash; there is no service worker or guarantee of an offline reload.
Calendar submission/upgrading and Bitcoin explorer queries still need network access and remain subject to remote CORS
policy. The test does not contact those services or establish their live availability.

Production publication remains a separate authorized maintainer action. Review the required CI, independent verification,
signing, accessibility and operational gates in [RELEASE.md](RELEASE.md) before enabling deployment. No production release
or Pages deployment is authorized by this preparation workflow.

After explicit publication authorization, maintainers can separately enable GitHub Actions as the Pages source and add
a protected deployment job using a reviewed, full-SHA-pinned `actions/deploy-pages`. That job must depend on successful
preparation, use the `github-pages` environment and grant only its required `pages: write` and `id-token: write`
permissions. GitHub's documented arrangement consumes the artifact from the same workflow run; an expired readiness
artifact requires a fresh qualified run. A generic downloaded review ZIP is not a replacement for that Pages artifact.
No deployment job or repository-setting change is prepared as an automatically executable part of this workflow.

Action review on 2026-11-05: the official MIT-licensed
[`actions/upload-pages-artifact` v5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0) resolves to
`fc324d3547104276b827a68afc52ff2a11cc49c9`. Its pinned
[`action.yml`](https://github.com/actions/upload-pages-artifact/blob/fc324d3547104276b827a68afc52ff2a11cc49c9/action.yml)
packages the directory with tar and delegates upload to full-SHA-pinned `actions/upload-artifact` v7.0.0; it contains no
Pages settings or deployment call. No third-party source was copied and no runtime dependency was added. GitHub's
[custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
describes the artifact and separate deployment requirements. Local workflow regression tests check the preparation
contract; a hosted readiness run must still establish successful upload on the final candidate.
