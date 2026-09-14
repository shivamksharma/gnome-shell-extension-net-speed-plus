#!/usr/bin/env bash
#
# Build both the legacy (GNOME 42-44) and modern (GNOME 45+) packages.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/build-modern.sh"
"$SCRIPT_DIR/build-legacy.sh"
