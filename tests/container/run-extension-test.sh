#!/usr/bin/env bash
#
# Run the extension enable/disable runtime test inside an existing container
# created by setup-container.sh. The container is left untouched (no cleanup).
#
# Usage:
#   ./run-extension-test.sh <container-name> <package.zip> <extension-uuid>
#
# Example:
#   ./run-extension-test.sh gnome46 dist/net-speed-plus-modern-v4.shell-extension.zip \
#       netspeed@shivamksharma.github.io
#
set -euo pipefail

NAME="${1:?usage: run-extension-test.sh <container> <package.zip> <uuid>}"
ZIP="${2:?usage: run-extension-test.sh <container> <package.zip> <uuid>}"
UUID="${3:?usage: run-extension-test.sh <container> <package.zip> <uuid>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ZIP="$(cd "$(dirname "$ZIP")" && pwd)/$(basename "$ZIP")"

docker cp "$ZIP" "$NAME:/package.zip"
docker cp "$HERE/gs-runtime-test2.sh" "$NAME:/root/gs-runtime-test2.sh"

docker exec \
    -e XDG_CONFIG_HOME=/root/gnome-test/config \
    -e XDG_DATA_HOME=/root/gnome-test/data \
    -e XDG_CACHE_HOME=/root/gnome-test/cache \
    -e XDG_RUNTIME_DIR=/root/gnome-test/run \
    -e GSETTINGS_BACKEND=memory \
    -e LIBGL_ALWAYS_SOFTWARE=1 \
    -e GALLIUM_DRIVER=llvmpipe \
    -e EXT_UUID="$UUID" \
    -e SHELL_LOG=/root/gnome-test/shell.log \
    "$NAME" bash -c '
        mkdir -p /run/dbus
        [ -S /run/dbus/system_bus_socket ] || dbus-daemon --system --fork
        # Without /run/systemd, GNOME Shell uses its dummy login manager.
        rm -rf /root/gnome-test /run/systemd
        mkdir -p "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$XDG_CACHE_HOME" "$XDG_RUNTIME_DIR"
        chmod 700 "$XDG_RUNTIME_DIR"

        EXT="$XDG_DATA_HOME/gnome-shell/extensions/$EXT_UUID"
        mkdir -p "$EXT"
        unzip -q /package.zip -d "$EXT"
        glib-compile-schemas "$EXT/schemas"

        timeout 180 dbus-run-session -- bash /root/gs-runtime-test2.sh
        echo "INNER_EXIT=$?"
        echo "=== extension-related log lines ==="
        grep -iE "JS ERROR|Gjs-CRITICAL|'"$UUID"'" "$SHELL_LOG" | head -5 || true
    '
