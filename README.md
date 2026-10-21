# Unaltered

Unaltered is a shared toolkit of agent skills and Python scripts for building and releasing JUCE audio plug-in projects. It contains no plug-in source code of its own. The project-creation script expects a separate JUCE starter repository (`JUCE-Plugin-Starter`), which is not in this repository.

Licensed under the MIT License. See [LICENSE](LICENSE).

## Contents

| Path | What it is |
|---|---|
| `shared/scripts/` | Python and shell helpers for project creation, versioning, release builds, release notes, update setup, port auditing, VM registry, and project inspection |
| `skills/` | About 70 agent skill folders (JUCE project creation, operations, CI and release, cross-platform ports, UI and build helpers, plus general engineering and document skills), and a `registry.json` |
| `skills/_third_party_licenses/` | Licence and notice files for bundled third-party skill material |
| `.github/agents/feature-auditor.agent.md` | Instructions for an audit agent that checks a project's source against its specification |

## Scripts

- `create_project.py` creates a new JUCE starter project from a `JUCE-Plugin-Starter` checkout. It locates the starter with `find_starter_repo.py`, copies it without the excluded folders, substitutes names, writes an `.env`, and can initialise git and create a GitHub repository.
- `bump_version.py` reads and updates version numbers in a plug-in project's `.env` file.

The other scripts cover release building, release notes, update configuration, and inspection and auditing of JUCE projects. Each script's `--help` output is the reference for its arguments.

## Verification status

Each Python script in `shared/scripts/` was byte-compiled with `python3 -m py_compile`, and `create_project.py --help` ran. No functional tests exist in this repository, and no project was created or released with these scripts in this pass.

## Wiki

Documentation pages are in [`docs/wiki/`](docs/wiki/Home.md).
