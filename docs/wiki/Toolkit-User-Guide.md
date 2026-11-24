# Toolkit User Guide — bundled JUCE helpers (not Unaltered)

[Wiki Home](Home.md) · [Unaltered User Guide](User-Guide.md) · [Toolkit Developer Guide](Toolkit-Developer-Guide.md)

`create_project.py` needs a local `JUCE-Plugin-Starter` checkout. Pass it with `--starter`, or let `find_starter_repo.py` search the default locations (the current directory, `~/Code`, `~/Developer`, `~/src`). The optional `--clone-missing` flag can retrieve the starter if absent.

```sh
python3 shared/scripts/create_project.py "My Plugin" --starter /path/to/JUCE-Plugin-Starter --destination-parent /path/to/projects
python3 shared/scripts/create_project.py --help
```

Options cover developer name, bundle ID, GitHub user and repository creation, signing identifiers, diagnostics, and forced overwrite. Review the help and script before using options that change files or remote repositories. Avoid putting credentials on command lines or in shell history.

The wrapper validates the starter before overwriting a destination: it requires the starter markers, rejects linked or non-regular entries in the copied tree, and refuses overlapping source and destination directories. Missing destination-parent directories are created normally. `--force` replaces an unrelated destination directory; it cannot replace a symlink or remove the source template.

The wrapper does not accept or store an app-specific password. The removed password option fails without repeating its value. Configure notarization credentials separately in the system keychain; the generated `.env` leaves its password field empty.

Configuration options must be single-line text. Values in the generated `.env` are quoted so shell expansion cannot execute project names, signing identifiers, or paths when the file is loaded.

For project versions, `bump_version.py` updates version numbers in the target project's `.env`. The tools are distinct from Unaltered's fingerprinting, receipts, verification and release artifacts. See [Toolkit Codebase Map](Codebase-Map.md).

The Python helpers read `.env` values as literal data. They decode the starter generator's quote, backslash, dollar-sign and backtick escapes without expanding variables or executing commands. Updater configuration rewrites preserve those literals. Keep `env_config.py` beside the helper scripts when copying the toolkit.
