# GitHub Pages preparation

Unaltered builds to a static site in `dist/web/`. Serve that directory as a unit. It requires no Node runtime or server
application after building. JavaScript and CSS references are relative, navigation uses URL fragments, and the hash
worker runs from source pinned within the page script. The site therefore supports the repository project path
`/Unaltered/` as well as a domain root. Preserve the trailing slash on a directory URL.

The existing **CI** workflow uploads the official `github-pages` artifact from its Chromium matrix job after the full
built-site browser suite passes with zero retries, including the project-path/offline test. Firefox and WebKit do not
upload a duplicate. This route works for candidate pull requests before the standalone readiness workflow is available.
The artifact reflects that job's tested checkout; record its run and SHA. Other CI and release gates still need to pass
before publication eligibility, even when Chromium has already uploaded an artifact.

The separate **Pages readiness artifact** workflow is manual (`workflow_dispatch`). GitHub registers manual workflows
only when their file is present on the default branch; a candidate-only copy cannot yet be dispatched by selecting its
ref. Once registered, select the candidate branch in Actions. It
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
The readiness workflow remains preparation only. The separate deployment template below is not installed as an active workflow.

Action review on 2026-11-05: the official MIT-licensed
[`actions/upload-pages-artifact` v5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0) resolves to
`fc324d3547104276b827a68afc52ff2a11cc49c9`. Its pinned
[`action.yml`](https://github.com/actions/upload-pages-artifact/blob/fc324d3547104276b827a68afc52ff2a11cc49c9/action.yml)
packages the directory with tar and delegates upload to full-SHA-pinned `actions/upload-artifact` v7.0.0; it contains no
Pages settings or deployment call. No third-party source was copied and no runtime dependency was added. GitHub's
[custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
describes the artifact and separate deployment requirements. Local workflow regression tests check the preparation
contract; a hosted CI or readiness run must still establish successful upload on the final candidate. GitHub documents
the default-branch prerequisite for
[`workflow_dispatch`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).

Manual CI dispatch also requires permission in the credential making the API request.
On 2026-11-05 at 22:00 UTC, the active registered CI workflow accepted read requests, but
`POST /repos/djshellshoxxx/Unaltered/actions/workflows/379498388/dispatches` returned
HTTP403, `Resource not accessible by integration`, with
`X-Accepted-GitHub-Permissions: actions=write`. No run was created by that request.
This is a credential authorization boundary, separate from the workflow's own read-only
job permissions. The repository metadata response's user-role flags do not grant that
permission to the credential. GitHub documents the required
[Actions write permission for dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
and the [meaning of this response header](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#resource-not-accessible).
An authorized maintainer or credential is required to dispatch; changing the site or
granting its jobs additional permissions does not repair this CLI-token limitation.
Repository Actions settings could not be inspected with this credential either (HTTP403,
`administration=read` required), so runner capacity, allowed-action restrictions and
repository security settings are not inferred from a queued run.

For the owner: open **Actions → CI → Run workflow**, select the reviewed development branch, and dispatch CI
without dispatching the release or paid-development workflows. GitHub documents this
[browser route for users with repository write access](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
Alternatively, use a separately authorized, repository-scoped credential with Actions write permission; do not paste it
into a PR, log or frontend asset. The existing token cannot grant itself that permission.
[Codespaces permission changes](https://docs.github.com/en/codespaces/managing-your-codespaces/managing-repository-access-for-your-codespaces)
apply to new codespaces after owner authorization, not the current codespace, even after a rebuild. No credential,
devcontainer permission or repository-setting change was made here. A successful dispatch alone would not establish
runner availability or a passing CI result.

`docs/templates/pages-deployment.yml` is an **inactive, not installed** deployment template. GitHub only discovers
[workflow files under `.github/workflows/`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax); keeping the template under `docs/templates/` does not register or dispatch it.
It changes no site assets, adds no backend, embeds no secrets, and does not invoke `configure-pages` or configure the
repository. Its presence is preparation, not publication authorization or evidence of a successful deployment.

The template repeats the existing readiness job because that workflow does not expose `workflow_call`; calling it as a
reusable workflow would fail. Contract tests keep the readiness steps, environment and time limit aligned with that
workflow after a first, case-sensitive preflight. Both review and official Pages uploads follow locked installation,
`npm run check`, build and the zero-retry Chromium project-path/offline check. The deployment job depends on successful preparation and consumes the named
`github-pages` artifact from the **same run**. It cannot select an artifact from another CI/readiness run. There is no
artifact download/re-upload or externally supplied artifact/run identifier.

Even after installation, the only trigger is manual dispatch. Both jobs require `authorize_deployment: true`, the
default branch ref, and `reviewed_commit` equal to the run's full `github.sha`; the authorization input defaults to
`false`. An ordinary non-default branch, an incorrect/empty commit, or unchecked authorization skips both jobs.
GitHub [ignores case in expression string comparisons](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#operators),
so preparation begins with a Bash preflight that compares `GITHUB_REF` to the exact default-branch ref and `GITHUB_SHA`
to the exact reviewed SHA using case-sensitive, quoted shell tests. Both supplied values enter through step environment
variables rather than insertion into the shell script. A case-only branch mismatch or SHA mismatch fails before
checkout, tests, build and artifact upload; deployment remains blocked by its successful-preparation dependency. This binds the build
and upload to the selected reviewed commit; it does not mechanically prove a review or satisfy the independent release
gates. Root permissions are empty, preparation has only `contents: read`, and deployment has only `pages: write` and
`id-token: write`. The deploy job runs no repository code and checks out no files. Publication runs share a concurrency
group with cancellation disabled so a later dispatch does not interrupt an ongoing publication.

Only after separate explicit owner authorization to publish, the repository owner must complete these steps:

1. Complete and record every applicable gate in [RELEASE.md](RELEASE.md), including review of the exact default-branch
   candidate and its successful required CI. Preparation tests and the template do not establish signing, independent
   verification, accessibility, release eligibility, or live Pages availability.
2. In **Settings → Environments**, pre-create `github-pages`, restrict deployment branches to the default branch, set
   required reviewers, enable prevention of self-review, and disable administrator bypass of protection rules. Verify
   these controls are available and configured for this repository before continuing. Merely referencing the environment
   in YAML can create an **unprotected** environment; this template cannot install protection rules or inspect settings.
   GitHub documents these [environment controls and automatic creation behavior](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
3. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. Separately review an activation
   PR that copies `docs/templates/pages-deployment.yml` to `.github/workflows/pages-deployment.yml`, reverify all action
   pins, and merge that activation change to the protected default branch. Review and record the resulting full commit
   SHA, including the activation change. Neither setting nor workflow installation is performed by preparation.
4. Using an authorized account, open **Actions → Authorized Pages publication → Run workflow**, select the default
   branch, enter that full SHA as `reviewed_commit`, and select `authorize_deployment` only with explicit owner publication
   authorization. Leaving its default `false` cannot publish. A moved branch head must be reviewed again and entered as
   the new exact SHA; a stale SHA skips preparation or fails its exact-match preflight, blocking deployment.
5. Inspect the successful preparation job and its official `github-pages` artifact for that run/SHA, then have the
   required environment reviewer verify those records and approve the waiting deployment job. If the artifact has
   expired, perform a new qualified run rather than approving a stale one. Record deployment result and URL, then verify
   the actual `/Unaltered/` site after publication. An artifact upload or accepted dispatch alone is not success evidence.

No activation, settings change, workflow dispatch, environment approval or deployment was performed by this preparation.
The known credential restrictions above still apply; the template does not grant the current credential Actions write
or administration access. The existing CI/readiness artifacts remain review evidence and are not automatically promoted.

Action source review on 2026-11-05 verified official Git tag resolution, each pinned `action.yml`, and each repository's
MIT license. All JavaScript actions below use the Node 24 action runtime on GitHub-hosted `ubuntu-latest`; `setup-node`
selects Node 22 for the project's own commands. No action implementation was copied or runtime dependency added.

| Official action and reviewed release | Full commit pin / action contract | License |
| --- | --- | --- |
| [`actions/checkout` v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | [`3d3c42e5aac5ba805825da76410c181273ba90b1`](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/action.yml); event SHA checkout, credentials not persisted | [MIT](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/LICENSE) |
| [`actions/setup-node` v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) | [`949feb2413d6458794dcd2491c4babbbce0c15c1`](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/action.yml); `node-version: 22` | [MIT](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/LICENSE) |
| [`actions/upload-artifact` v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | [`cf430e030ddbb5b0abf93d22962f4752f3646cd9`](https://github.com/actions/upload-artifact/blob/cf430e030ddbb5b0abf93d22962f4752f3646cd9/action.yml); review copy, missing files fail | [MIT](https://github.com/actions/upload-artifact/blob/cf430e030ddbb5b0abf93d22962f4752f3646cd9/LICENSE) |
| [`actions/upload-pages-artifact` v5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0) | [`fc324d3547104276b827a68afc52ff2a11cc49c9`](https://github.com/actions/upload-pages-artifact/blob/fc324d3547104276b827a68afc52ff2a11cc49c9/action.yml); composite packages `artifact.tar` and delegates upload to full-SHA-pinned upload-artifact v7.0.0 | [MIT](https://github.com/actions/upload-pages-artifact/blob/fc324d3547104276b827a68afc52ff2a11cc49c9/LICENSE) |
| [`actions/deploy-pages` v5.0.1](https://github.com/actions/deploy-pages/releases/tag/v5.0.1) | [`368f82528645a54fb793d4d04e342629a3f51346`](https://github.com/actions/deploy-pages/blob/368f82528645a54fb793d4d04e342629a3f51346/action.yml); `artifact_name: github-pages`, `preview: false`, `page_url` output | [MIT](https://github.com/actions/deploy-pages/blob/368f82528645a54fb793d4d04e342629a3f51346/LICENSE) |

The pinned deploy action's [artifact client](https://github.com/actions/deploy-pages/blob/368f82528645a54fb793d4d04e342629a3f51346/src/internal/api-client.js)
looks up artifacts in its own workflow run and rejects missing or duplicate names. The composite upload action's nested
[`actions/upload-artifact` v7.0.0](https://github.com/actions/upload-artifact/blob/bbbca2ddaa5d8feaa63e36b76fdaad77386f024f/action.yml)
pin `bbbca2ddaa5d8feaa63e36b76fdaad77386f024f` was also checked against its official Git tag and
[MIT license](https://github.com/actions/upload-artifact/blob/bbbca2ddaa5d8feaa63e36b76fdaad77386f024f/LICENSE). Its default GitHub token and OIDC
flow need the deployment job's two write permissions; no PAT or frontend credential is supplied. The official
[deploy action requirements](https://github.com/actions/deploy-pages/tree/368f82528645a54fb793d4d04e342629a3f51346#security-considerations)
and [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
require the prior upload, job dependency and protected environment arrangement. Local contract tests validate the
inactive template's dependency, permissions, input and action wiring; they do not substitute for hosted validation of
the separately authorized activation commit, effective repository protections, artifact upload or publication.
