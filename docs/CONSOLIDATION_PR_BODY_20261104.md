Consolidates the cached PR47 hardening candidate, preserving its security, accessibility, metadata, hashing and OTS
changes. Adds PR48's unique cancellation tests and CI isolation, PR49's OpenAlex parameter fix, strict hash-worker
message validation and cleanup, browser-normalized URL guards, and stale share-link fingerprint clearing. PR39's
calendar acceptance corrections are already included. API automation PRs remain separate.

Adds a manual read-only Pages review-artifact workflow and a nested `/Unaltered/` smoke test covering actual worker
hashing after going offline. It contains no deployment job. Large-file CI job budgets now allow all three accepted
attempts without weakening each attempt's deadline or memory assertion.

Validation: TypeScript/lint/OPSEC clean; combined available unit qualification 313 passed/4 skipped, including virtual
Node 2 GiB acceptance (stdout subprocess test excluded); focused Node build/package/workflow/executor
25 passed/1 platform skip; Python search and shell tests 10 passed; two byte-identical builds and release checksums
passed. Full process/browser/reference qualification remains required: this executor denies some child processes,
FIFO creation and loopback binding. No new browser or remote CI pass is claimed.

See `docs/AUTONOMOUS_HANDOFF_20261104.md` for commits, failing checks, dependencies and recovery. Existing human,
SonarCloud, live calendar CORS and independent release gates remain open. No main merge or production publication.
