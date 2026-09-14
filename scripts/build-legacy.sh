#!/usr/bin/env bash
#
# Build the GNOME 42-44 (legacy, imports.*) extension package.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build/legacy"
DIST_DIR="$ROOT_DIR/dist"
LEGACY_METADATA="$ROOT_DIR/metadata/metadata.legacy.json"

cd "$ROOT_DIR"

command -v node >/dev/null 2>&1 || { echo "error: node is required" >&2; exit 1; }
command -v zip >/dev/null 2>&1 || { echo "error: zip is required" >&2; exit 1; }

VERSION="$(node -p 'require(process.argv[1]).version' "$LEGACY_METADATA")"

echo "Building Net Speed Plus (legacy, GNOME 42-44) version $VERSION"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

cp "$LEGACY_METADATA" "$BUILD_DIR/metadata.json"
cp "$ROOT_DIR/stylesheet.css" "$BUILD_DIR/stylesheet.css"
cp "$ROOT_DIR/LICENSE" "$BUILD_DIR/LICENSE"
cp "$ROOT_DIR/README.md" "$BUILD_DIR/README.md"
cp -r "$ROOT_DIR/schemas" "$BUILD_DIR/schemas"

# Shared core and shell modules are written once as ES modules and converted
# to legacy GJS modules (imports.* / var exports) at build time.
node "$ROOT_DIR/scripts/lib/esm2legacy.mjs" "$ROOT_DIR/src" "$BUILD_DIR" core shell

cp "$ROOT_DIR/src/legacy/extension.js" "$BUILD_DIR/extension.js"
cp "$ROOT_DIR/src/legacy/prefs.js" "$BUILD_DIR/prefs.js"

if command -v glib-compile-schemas >/dev/null 2>&1; then
    glib-compile-schemas --strict --dry-run "$BUILD_DIR/schemas"
fi

ZIP_NAME="net-speed-plus-legacy-v${VERSION}.shell-extension.zip"
rm -f "$DIST_DIR/$ZIP_NAME"
(cd "$BUILD_DIR" && zip -qr "$DIST_DIR/$ZIP_NAME" .)

echo "Package: dist/$ZIP_NAME"
