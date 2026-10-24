## What and why
<!-- Link the requirement ID(s) from docs/SPEC.md and the task ID(s) from docs/TODO.md. -->

## Security checklist
- [ ] `./scripts/opsec-check.sh` passes
- [ ] No new runtime dependency (or ADR + `docs/DEPENDENCIES.md` entry linked)
- [ ] No new network host (or allowlist, CSP, and SPEC §9 updated)
- [ ] No `eval`, `innerHTML`, inline handlers, third-party origins
- [ ] Any code that can produce `VERIFIED` has negative tests
- [ ] Parsers treat input as hostile (caps, bounds checks, fail closed)
- [ ] No personal paths, emails, or names in the diff; commits signed with the project identity

## Tests
<!-- What you added or ran. For parser changes: fixtures and property/fuzz tests. -->

## Docs
- [ ] SPEC / THREAT_MODEL / TODO updated if behaviour or risk changed
