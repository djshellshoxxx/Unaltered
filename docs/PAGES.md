# GitHub Pages preparation

Unaltered builds to a static site in `dist/web/`. Serve that directory as a unit. It requires no Node runtime or server
application after building. JavaScript and CSS references are relative, navigation uses URL fragments, and the hash
worker runs from source pinned within the page script. The site therefore supports the repository project path
`/Unaltered/` as well as a domain root. Preserve the trailing slash on a directory URL.

The **Pages readiness artifact** workflow is manual (`workflow_dispatch`). Select the candidate branch in Actions to run
checks, build, and a Chromium project-path test, then download `unaltered-pages-review`. Its contents are the site root.
This is a normal review artifact: the workflow has read-only repository permissions and no deployment job. It does not
configure GitHub Pages, change repository settings, publish a release, or upload a Pages deployment artifact.

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
