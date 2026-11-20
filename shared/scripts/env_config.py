"""Literal single-line .env values shared by the bundled Python helpers.

This parser never sources a shell, interpolates variables, or evaluates commands.
Double quotes decode only the four escapes emitted by the starter generator.
"""
from pathlib import Path
import re


def parse_env(path: Path | str) -> dict[str, str]:
    path = Path(path)
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").split("\n"):
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key) is None:
            continue
        if len(value) >= 2 and value[0] == value[-1] == "'":
            value = value[1:-1]
        elif len(value) >= 2 and value[0] == value[-1] == '"':
            value = re.sub(r'\\([\\"$`])', r'\1', value[1:-1])
        values[key] = value
    return values


def env_literal(value: str, *, always_quote: bool = False) -> str:
    """Serialize data as a shell-safe assignment value without changing its text."""
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("Environment values must be single-line text without control characters.")
    if not always_quote and re.fullmatch(r"[A-Za-z0-9_./:@%+=,-]*", value):
        return value
    return '"' + re.sub(r'([\\"$`])', r'\\\1', value) + '"'
