#!/usr/bin/env bash
#
# Build the GNOME 45+ (modern, ESModule) extension package.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build/modern"
DIST_DIR="$ROOT_DIR/dist"

cd "$ROOT_DIR"

command -v node >/dev/null 2>&1 || { echo "error: node is required" >&2; exit 1; }
command -v zip >/dev/null 2>&1 || { echo "error: zip is required" >&2; exit 1; }

VERSION="$(node -p 'require(process.argv[1]).version' "$ROOT_DIR/metadata.json")"

echo "Building Net Speed Plus (modern, GNOME 45+) version $VERSION"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

cp "$ROOT_DIR/metadata.json" "$BUILD_DIR/metadata.json"
cp "$ROOT_DIR/stylesheet.css" "$BUILD_DIR/stylesheet.css"
cp "$ROOT_DIR/LICENSE" "$BUILD_DIR/LICENSE"
cp "$ROOT_DIR/README.md" "$BUILD_DIR/README.md"
cp -r "$ROOT_DIR/schemas" "$BUILD_DIR/schemas"
cp -r "$ROOT_DIR/src/core" "$BUILD_DIR/core"
cp -r "$ROOT_DIR/src/shell" "$BUILD_DIR/shell"

# The modern entry points live at the package root, so their relative imports
# must be rewritten from ../ to ./ for the flat package layout.
sed "s#'\.\./#'./#g" "$ROOT_DIR/src/modern/extension.js" > "$BUILD_DIR/extension.js"
sed "s#'\.\./#'./#g" "$ROOT_DIR/src/modern/prefs.js" > "$BUILD_DIR/prefs.js"

if command -v glib-compile-schemas >/dev/null 2>&1; then
    glib-compile-schemas --strict --dry-run "$BUILD_DIR/schemas"
fi

ZIP_NAME="net-speed-plus-modern-v${VERSION}.shell-extension.zip"
rm -f "$DIST_DIR/$ZIP_NAME"
(cd "$BUILD_DIR" && zip -qr "$DIST_DIR/$ZIP_NAME" .)

echo "Package: dist/$ZIP_NAME"
