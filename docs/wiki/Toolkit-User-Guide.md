# Toolkit User Guide — bundled JUCE helpers (not Unaltered)

[Wiki Home](Home.md) · [Unaltered User Guide](User-Guide.md) · [Toolkit Developer Guide](Toolkit-Developer-Guide.md)

`create_project.py` needs a local `JUCE-Plugin-Starter` checkout. Pass it with `--starter`, or let `find_starter_repo.py` search the default locations (the current directory, `~/Code`, `~/Developer`, `~/src`). The optional `--clone-missing` flag can retrieve the starter if absent.

```sh
python3 shared/scripts/create_project.py "My Plugin" --starter /path/to/JUCE-Plugin-Starter --destination-parent /path/to/projects
python3 shared/scripts/create_project.py --help
```

Options cover developer name, bundle ID, GitHub user and repository creation, signing identifiers, diagnostics, and forced overwrite. Review the help and script before using options that change files or remote repositories. Avoid putting credentials on command lines or in shell history.

For project versions, `bump_version.py` updates version numbers in the target project's `.env`. The tools are distinct from Unaltered's fingerprinting, receipts, verification and release artifacts. See [Toolkit Codebase Map](Codebase-Map.md).
