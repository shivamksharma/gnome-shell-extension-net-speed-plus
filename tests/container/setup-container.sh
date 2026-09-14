#!/usr/bin/env bash
#
# Create (or reuse) a Docker container for running GNOME Shell extension
# runtime tests, and install the required packages. The container is left
# running so it can be reused for more extensions.
#
# Usage:
#   ./setup-container.sh <image> <container-name>
#
# Examples (GNOME version -> image):
#   debian:12     -> GNOME 43   (legacy 42-44)
#   ubuntu:23.04  -> GNOME 44   (legacy 42-44)
#   ubuntu:24.04  -> GNOME 46   (modern 45+)
#   debian:13     -> GNOME 48   (modern 45+)
#   ubuntu:26.04  -> GNOME 50   (modern 45+)
#
set -euo pipefail

IMAGE="${1:?usage: setup-container.sh <image> <container-name>}"
NAME="${2:?usage: setup-container.sh <image> <container-name>}"

if docker inspect "$NAME" >/dev/null 2>&1; then
    echo "container '$NAME' already exists; reusing it"
else
    docker run -d --name "$NAME" "$IMAGE" sleep infinity >/dev/null
    echo "created container '$NAME' from $IMAGE"
fi

docker exec "$NAME" bash -c '
    set -e
    if command -v apt-get >/dev/null 2>&1; then
        # End-of-life Ubuntu images need the old-releases archive.
        if ! apt-get update -qq 2>/dev/null; then
            sed -i \
                -e "s|//archive.ubuntu.com|//old-releases.ubuntu.com|g" \
                -e "s|//security.ubuntu.com|//old-releases.ubuntu.com|g" \
                -e "s|//ports.ubuntu.com|//old-releases.ubuntu.com|g" \
                /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true
            apt-get update -qq
        fi

        BASE="gnome-shell dbus dbus-x11 libglib2.0-bin unzip libgl1-mesa-dri libegl-mesa0"
        if ! DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
                dbus-daemon $BASE >/tmp/apt.log 2>&1; then
            DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
                $BASE >/tmp/apt.log 2>&1
        fi
    elif command -v dnf >/dev/null 2>&1; then
        dnf -y install gnome-shell glib2 unzip mesa-dri-drivers dbus-tools dbus-daemon \
            >/tmp/apt.log 2>&1
    else
        echo "unsupported package manager" >&2
        exit 1
    fi

    echo "GNOME Shell: $(gnome-shell --version)"
'

echo "container '$NAME' is ready"
