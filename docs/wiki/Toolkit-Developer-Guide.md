# Toolkit Developer Guide — bundled JUCE helpers

[Wiki Home](Home.md) · [Unaltered Developer Guide](Developer-Guide.md) · [Toolkit Codebase Map](Codebase-Map.md)

Scripts are in `shared/scripts/`. Agent skills are in `skills/<name>/SKILL.md`, with optional `scripts/`, `templates/` and `references/`. Licences for third-party skill material are in `skills/_third_party_licenses/`.

For syntax and basic invocation:

```sh
for f in shared/scripts/*.py; do python3 -m py_compile "$f"; done
python3 shared/scripts/create_project.py --help
```

The repository also contains toolkit-related tests in `tests/toolkit/`; these are not evidence that each bundled helper is end-to-end qualified. Run the relevant `npm run check` gates and any script-specific checks before changing or publishing tooling. Clean generated `__pycache__` folders before committing. Follow [CONTRIBUTING](https://github.com/djshellshoxxx/Unaltered/blob/main/CONTRIBUTING.md) and keep toolkit changes separate from app receipt/verification work.
