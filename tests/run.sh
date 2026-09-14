#!/usr/bin/env bash
#
# Run the core unit tests (GNOME 45+ ES modules) and the legacy integration
# tests against the transpiled GNOME 42-44 output.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

command -v gjs >/dev/null 2>&1 || { echo "error: gjs is required" >&2; exit 1; }

echo "== Core unit tests (ES modules) =="
gjs -m tests/core.test.mjs

echo
echo "== Legacy integration tests (transpiled GNOME 42-44) =="
"$ROOT_DIR/scripts/build-legacy.sh" >/dev/null
gjs tests/legacy.test.js
