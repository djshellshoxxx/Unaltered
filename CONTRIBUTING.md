# Contributing

Thanks for helping. This is security-sensitive software, so the rules are stricter than usual.

## Ground rules

1. **No new runtime dependency without an ADR.** Add an entry to `docs/DECISIONS.md` and `docs/DEPENDENCIES.md` explaining what it does, who maintains it, whether it has been audited, and why we cannot write it in under 200 lines.
2. **No network calls** except to hosts in the allowlist in `docs/SPEC.md` section 9, and only through `src/core/net`.
3. **No `eval`, `new Function`, `innerHTML`, inline scripts, or inline event handlers.** Use `textContent` and DOM APIs. CSP and Trusted Types will block them anyway.
4. **No telemetry, analytics, third-party fonts, or CDNs.**
5. **Fail closed.** Unknown input is refused with a clear message, never passed through.
6. **Tests with every change.** Parsers need fixtures and property or fuzz tests.
7. **Use only the test-vector files in `tests/vectors/`** and synthetic fixtures. Never commit real-world sensitive files or photos with metadata.

## Workflow

1. Open an issue or pick a task from `docs/TODO.md`.
2. Branch from `main`. Use signed commits.
3. Run `npm run check` before pushing (once the toolchain is installed, see TODO task M0-1).
4. Open a pull request. Fill in the template. CI must be green.

## Privacy of contributors

You may contribute pseudonymously. Please set a neutral git identity for this repository only:

```bash
git config user.name "your-handle"
git config user.email "your-handle@users.noreply.github.com"
./scripts/opsec-check.sh
```

## Security issues

Do not file public issues. See `SECURITY.md`.
