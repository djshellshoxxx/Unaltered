# Developer Guide

## Layout

Scripts live in `shared/scripts/`. Skills live in `skills/<name>/SKILL.md` with optional `scripts/`, `templates/` and `references/` folders. Third-party licence files are under `skills/_third_party_licenses/`.

## Checks

The repository has no automated test suite. The checks run in the verification pass were:

```sh
for f in shared/scripts/*.py; do python3 -m py_compile "$f"; done
python3 shared/scripts/create_project.py --help
```

Remove any `__pycache__` folders created by these checks before committing.
