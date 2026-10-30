#!/bin/bash

set -euo pipefail

ROOT_DIR="$(pwd)"
EXTERNAL_DIR="$ROOT_DIR/external"
WINSPARKLE_DIR="$EXTERNAL_DIR/WinSparkle"
WINSPARKLE_VERSION="${WINSPARKLE_VERSION:-0.9.2}"
if [[ ! "$WINSPARKLE_VERSION" =~ ^[0-9]+(\.[0-9]+)*(-[A-Za-z0-9]+(\.[A-Za-z0-9]+)*)?$ ]]; then
    echo "Error: WINSPARKLE_VERSION must look like 1.2.3 or 1.2.3-beta.1"
    exit 1
fi
WINSPARKLE_URL="https://github.com/vslavik/winsparkle/releases/download/v${WINSPARKLE_VERSION}/WinSparkle-${WINSPARKLE_VERSION}.zip"

echo "=== Setting up WinSparkle $WINSPARKLE_VERSION ==="

if [[ -f "$WINSPARKLE_DIR/include/winsparkle.h" ]]; then
    echo "WinSparkle already present at $WINSPARKLE_DIR"
    exit 0
fi

TEMP_DIR="$(mktemp -d)"
trap "rm -rf '$TEMP_DIR'" EXIT
ARCHIVE="$TEMP_DIR/WinSparkle.zip"

mkdir -p "$EXTERNAL_DIR"
# HTTPS only, including every redirect. Set WINSPARKLE_SHA256 to the published digest to verify the archive.
curl -fSL --proto '=https' --proto-redir '=https' "$WINSPARKLE_URL" -o "$ARCHIVE"
if [[ -n "${WINSPARKLE_SHA256:-}" ]]; then
    if command -v sha256sum >/dev/null 2>&1; then
        ACTUAL_SHA256="$(sha256sum "$ARCHIVE" | cut -d' ' -f1)"
    else
        ACTUAL_SHA256="$(shasum -a 256 "$ARCHIVE" | cut -d' ' -f1)"
    fi
    if [[ "$ACTUAL_SHA256" != "$(printf '%s' "$WINSPARKLE_SHA256" | tr 'A-F' 'a-f')" ]]; then
        rm -f "$ARCHIVE"
        echo "Error: WinSparkle archive SHA-256 does not match WINSPARKLE_SHA256"
        exit 1
    fi
else
    echo "Warning: WINSPARKLE_SHA256 is not set; the archive is trusted on HTTPS alone"
fi
cd "$TEMP_DIR"
unzip -q "$ARCHIVE"

EXTRACTED_DIR="$TEMP_DIR/WinSparkle-${WINSPARKLE_VERSION}"
if [[ ! -d "$EXTRACTED_DIR" ]]; then
    echo "Error: extracted WinSparkle directory not found"
    exit 1
fi

rm -rf "$WINSPARKLE_DIR"
mkdir -p "$WINSPARKLE_DIR"
cp -R "$EXTRACTED_DIR/include" "$WINSPARKLE_DIR/"

if [[ -d "$EXTRACTED_DIR/x64/Release" ]]; then
    mkdir -p "$WINSPARKLE_DIR/x64"
    cp "$EXTRACTED_DIR/x64/Release/WinSparkle.dll" "$WINSPARKLE_DIR/x64/"
    cp "$EXTRACTED_DIR/x64/Release/WinSparkle.lib" "$WINSPARKLE_DIR/x64/"
fi

if [[ -d "$EXTRACTED_DIR/ARM64/Release" ]]; then
    mkdir -p "$WINSPARKLE_DIR/arm64"
    cp "$EXTRACTED_DIR/ARM64/Release/WinSparkle.dll" "$WINSPARKLE_DIR/arm64/"
    cp "$EXTRACTED_DIR/ARM64/Release/WinSparkle.lib" "$WINSPARKLE_DIR/arm64/"
fi

if [[ -d "$EXTRACTED_DIR/bin" ]]; then
    cp -R "$EXTRACTED_DIR/bin" "$WINSPARKLE_DIR/"
fi

if [[ -f "$EXTRACTED_DIR/COPYING" ]]; then
    cp "$EXTRACTED_DIR/COPYING" "$WINSPARKLE_DIR/"
fi

echo "WinSparkle setup complete"
echo "  Root: $WINSPARKLE_DIR"
echo "  Tool: $WINSPARKLE_DIR/bin/winsparkle-tool.exe"
