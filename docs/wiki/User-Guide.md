# User Guide

## Create a project

`create_project.py` needs a local `JUCE-Plugin-Starter` checkout. Pass it with `--starter`, or let `find_starter_repo.py` search the default locations (the current directory, `~/Code`, `~/Developer`, `~/src`). Use `--clone-missing` to clone it if absent.

```sh
python3 shared/scripts/create_project.py "My Plugin" --starter /path/to/JUCE-Plugin-Starter --destination-parent /path/to/projects
```

Options cover developer name, bundle ID, GitHub user and repository creation, signing identifiers, diagnostics, and forced overwrite. Run `--help` for the full list. Signing options are passed on the command line, so avoid putting real credentials in shell history.

## Versions

`bump_version.py` updates version numbers in the project's `.env` file.
