#!/usr/bin/env bash
#
# Run the full test suite:
#   1. core unit tests (ES modules)
#   2. modern live pipeline test (ES modules, real /proc)
#   3. legacy integration tests (transpiled GNOME 42-44 modules, real /proc)
#   4. legacy preferences widget test (GTK4, skipped without a display)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

command -v gjs >/dev/null 2>&1 || { echo "error: gjs is required" >&2; exit 1; }

echo "== Transpiler unit tests (Node) =="
if command -v node >/dev/null 2>&1; then
    node --test tests/transpiler.test.mjs
else
    echo "SKIP: node is not available"
fi

echo
echo "== Core unit tests (ES modules) =="
gjs -m tests/core.test.mjs

echo
echo "== Modern live pipeline test (ES modules) =="
gjs -m tests/modern-network.test.mjs

echo
echo "== Legacy integration tests (transpiled GNOME 42-44) =="
"$ROOT_DIR/scripts/build-legacy.sh" >/dev/null
gjs tests/legacy.test.js

echo
echo "== Legacy preferences test (GTK4) =="
SCHEMA_DIR="$(mktemp -d)"
trap 'rm -rf "$SCHEMA_DIR"' EXIT
cp schemas/*.gschema.xml "$SCHEMA_DIR/"
glib-compile-schemas "$SCHEMA_DIR"
GSETTINGS_SCHEMA_DIR="$SCHEMA_DIR" GSETTINGS_BACKEND=memory gjs tests/prefs-legacy.test.js

echo
echo "== Modern preferences probe (GNOME 45+, self-skipping) =="
"$ROOT_DIR/scripts/build-modern.sh" >/dev/null
gjs -m tests/prefs-modern.probe.mjs

echo
echo "All test suites passed."
