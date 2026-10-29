#!/bin/bash

set -euo pipefail

ROOT_DIR="$(pwd)"
EXTERNAL_DIR="$ROOT_DIR/external"
SPARKLE_VERSION="${SPARKLE_VERSION:-2.8.0}"
if [[ ! "$SPARKLE_VERSION" =~ ^[0-9]+(\.[0-9]+)*$ ]]; then
    echo "Error: SPARKLE_VERSION must look like 1.2.3"
    exit 1
fi
SPARKLE_FRAMEWORK="$EXTERNAL_DIR/Sparkle.framework"

echo "=== Setting up Sparkle $SPARKLE_VERSION ==="

if [[ "$(uname)" != "Darwin" ]]; then
    echo "Error: Sparkle is macOS-only. Current platform: $(uname)"
    exit 1
fi

if [[ -d "$SPARKLE_FRAMEWORK" ]]; then
    echo "Sparkle framework already present at $SPARKLE_FRAMEWORK"
    exit 0
fi

mkdir -p "$EXTERNAL_DIR"

SPARKLE_URL="https://github.com/sparkle-project/Sparkle/releases/download/$SPARKLE_VERSION/Sparkle-$SPARKLE_VERSION.tar.xz"
DOWNLOAD_FILE="$EXTERNAL_DIR/sparkle-$SPARKLE_VERSION.tar.xz"

# HTTPS only, including every redirect. Set SPARKLE_SHA256 to the published digest to verify the archive.
curl -fSL --proto '=https' --proto-redir '=https' "$SPARKLE_URL" -o "$DOWNLOAD_FILE"
if [[ -n "${SPARKLE_SHA256:-}" ]]; then
    if command -v sha256sum >/dev/null 2>&1; then
        ACTUAL_SHA256="$(sha256sum "$DOWNLOAD_FILE" | cut -d' ' -f1)"
    else
        ACTUAL_SHA256="$(shasum -a 256 "$DOWNLOAD_FILE" | cut -d' ' -f1)"
    fi
    if [[ "$ACTUAL_SHA256" != "$(printf '%s' "$SPARKLE_SHA256" | tr 'A-F' 'a-f')" ]]; then
        rm -f "$DOWNLOAD_FILE"
        echo "Error: Sparkle archive SHA-256 does not match SPARKLE_SHA256"
        exit 1
    fi
else
    echo "Warning: SPARKLE_SHA256 is not set; the archive is trusted on HTTPS alone"
fi
cd "$EXTERNAL_DIR"
rm -rf Sparkle.framework bin Symbols sparkle.app "Sparkle Test App.app" CHANGELOG INSTALL LICENSE SampleAppcast.xml
tar -xf "sparkle-$SPARKLE_VERSION.tar.xz"
rm -f "sparkle-$SPARKLE_VERSION.tar.xz"

if [[ ! -d "$SPARKLE_FRAMEWORK" ]]; then
    echo "Error: Sparkle.framework not found after extraction"
    exit 1
fi

echo "Sparkle setup complete"
echo "  Framework: $SPARKLE_FRAMEWORK"
echo "  sign_update: $EXTERNAL_DIR/bin/sign_update"
echo "  generate_keys: $EXTERNAL_DIR/bin/generate_keys"
