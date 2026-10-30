#!/usr/bin/env python3

import argparse
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def write_env(path: Path, values: dict[str, str]) -> None:
    existing = path.read_text(encoding="utf-8", errors="ignore").splitlines() if path.exists() else []
    updated_keys = set()
    lines = []
    for line in existing:
        if line.strip() and not line.strip().startswith("#") and "=" in line:
            key = line.split("=", 1)[0].strip()
            if key in values:
                lines.append(f"{key}={values[key]}")
                updated_keys.add(key)
            else:
                lines.append(line)
        else:
            lines.append(line)
    for key, value in values.items():
        if key not in updated_keys:
            lines.append(f"{key}={value}")
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def default_branch(root: Path) -> str:
    result = subprocess.run(["git", "branch", "--show-current"], cwd=root, capture_output=True, text=True, check=False)
    branch = result.stdout.strip()
    return branch or "main"


# Download settings the setup scripts read; .env values apply unless the process environment already sets them.
DOWNLOAD_KEYS = ("SPARKLE_VERSION", "SPARKLE_SHA256", "WINSPARKLE_VERSION", "WINSPARKLE_SHA256")


def run_script(script: Path, root: Path, env: dict[str, str]) -> None:
    child_env = {**{key: env[key] for key in DOWNLOAD_KEYS if env.get(key)}, **os.environ}
    if script.suffix == ".py":
        subprocess.run(["python3", str(script)], cwd=root, check=True, env=child_env)
    else:
        subprocess.run([str(script)], cwd=root, check=True, env=child_env)


def ensure_appcast(path: Path, title: str, version: str) -> None:
    if path.exists():
        return
    contents = f"""<?xml version=\"1.0\" encoding=\"utf-8\"?>
<rss version=\"2.0\">
  <channel>
    <title>{title}</title>
    <link></link>
    <description>Auto-update feed placeholder</description>
    <item>
      <title>Version {version}</title>
      <description>Initial appcast placeholder</description>
    </item>
  </channel>
</rss>
"""
    path.write_text(contents, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Portable updater setup wrapper for JUCE starter projects.")
    parser.add_argument("--project-root", default=".")
    parser.add_argument("--platform", choices=["macos", "windows", "all"], default="all")
    parser.add_argument("--doctor", action="store_true")
    parser.add_argument("--generate-appcasts", action="store_true")
    parser.add_argument("--skip-download", action="store_true")
    args = parser.parse_args()

    root = Path(args.project_root).resolve()
    env_path = root / ".env"
    env = parse_env(env_path)

    github_user = env.get("GITHUB_USER", "")
    github_repo = env.get("GITHUB_REPO", "") or env.get("PROJECT_NAME", "")
    branch = default_branch(root)

    if args.platform in {"macos", "all"} and not args.skip_download:
        script = root / "scripts" / "setup_sparkle.sh"
        if not script.exists():
            script = Path(__file__).with_name("setup_sparkle.sh")
        run_script(script, root, env)

    if args.platform in {"windows", "all"} and not args.skip_download:
        script = root / "scripts" / "setup_winsparkle.sh"
        if not script.exists():
            script = Path(__file__).with_name("setup_winsparkle.sh")
        run_script(script, root, env)

    # Without a public key the updater cannot check signatures, so it stays off until one is configured.
    public_key = env.get("AUTO_UPDATE_EDDSA_PUBLIC_KEY", "")
    if not public_key:
        print(
            "AUTO_UPDATE_EDDSA_PUBLIC_KEY is empty: leaving ENABLE_AUTO_UPDATE=FALSE. "
            "Generate a key pair, set the public key in .env and run this again.",
            file=sys.stderr,
        )
    updates = {
        "ENABLE_AUTO_UPDATE": "TRUE" if public_key else "FALSE",
        "AUTO_UPDATE_MODE": env.get("AUTO_UPDATE_MODE", "public"),
        "AUTO_UPDATE_EDDSA_PUBLIC_KEY": public_key,
    }

    if github_user and github_repo:
        updates["AUTO_UPDATE_FEED_URL_MACOS"] = env.get(
            "AUTO_UPDATE_FEED_URL_MACOS",
            f"https://raw.githubusercontent.com/{github_user}/{github_repo}/{branch}/appcast-macos.xml",
        )
        updates["AUTO_UPDATE_FEED_URL_WINDOWS"] = env.get(
            "AUTO_UPDATE_FEED_URL_WINDOWS",
            f"https://raw.githubusercontent.com/{github_user}/{github_repo}/{branch}/appcast-windows.xml",
        )

    for key in ("AUTO_UPDATE_FEED_URL_MACOS", "AUTO_UPDATE_FEED_URL_WINDOWS"):
        feed = updates.get(key, env.get(key, ""))
        parsed = urlparse(feed)
        if feed and (parsed.scheme != "https" or not parsed.hostname):
            print(f"{key} must be an https:// URL; .env was not changed.", file=sys.stderr)
            return 1

    write_env(env_path, updates)

    if args.generate_appcasts:
        title = env.get("PRODUCT_NAME") or env.get("PROJECT_NAME") or root.name
        version = ".".join(
            [
                env.get("VERSION_MAJOR", "0"),
                env.get("VERSION_MINOR", "0"),
                env.get("VERSION_PATCH", "0"),
            ]
        )
        ensure_appcast(root / "appcast-macos.xml", f"{title} macOS Appcast", version)
        ensure_appcast(root / "appcast-windows.xml", f"{title} Windows Appcast", version)

    if args.doctor:
        subprocess.run(["python3", str(Path(__file__).with_name("auto_update_doctor.py")), str(root)], check=True)

    print(root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
