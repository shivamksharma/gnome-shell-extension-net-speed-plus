#!/usr/bin/env bash
# Runs inside the container/private dbus session: starts a headless GNOME Shell,
# enables the extension, and checks enable/disable cycles.
set -uo pipefail

UUID="${EXT_UUID:?EXT_UUID must be set}"
LOG="${SHELL_LOG:-/tmp/shell.log}"
BUS=(gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell)

gnome-shell --headless --no-x11 --virtual-monitor 1024x768 >"$LOG" 2>&1 &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; }
trap cleanup EXIT

ready=0
for _ in $(seq 1 80); do
    if "${BUS[@]}" --method org.gnome.Shell.Extensions.ListExtensions >/dev/null 2>&1; then
        ready=1
        break
    fi
    sleep 0.5
done
echo "shell ready: $ready"
if [ "$ready" != "1" ]; then
    echo "RESULT: SHELL_NOT_READY"
    echo "--- shell log ---"
    tail -30 "$LOG"
    exit 1
fi

state() {
    "${BUS[@]}" --method org.gnome.Shell.Extensions.GetExtensionInfo "$UUID" 2>/dev/null \
        | grep -oE "'state': <[0-9]+" | grep -oE '[0-9]+' || echo "?"
}
err() {
    "${BUS[@]}" --method org.gnome.Shell.Extensions.GetExtensionInfo "$UUID" 2>/dev/null \
        | grep -oE "'error': <'[^']*'>" || echo "?"
}

fails=0
for cycle in 1 2 3; do
    "${BUS[@]}" --method org.gnome.Shell.Extensions.EnableExtension "$UUID" >/dev/null 2>&1 || true
    sleep 2
    s="$(state)"
    echo "cycle $cycle enable: state=$s error=$(err)"
    [ "$s" = "1" ] || fails=$((fails + 1))

    "${BUS[@]}" --method org.gnome.Shell.Extensions.DisableExtension "$UUID" >/dev/null 2>&1 || true
    sleep 1
    s="$(state)"
    echo "cycle $cycle disable: state=$s"
    [ "$s" = "2" ] || fails=$((fails + 1))
done

if [ "$fails" -eq 0 ]; then
    echo "RESULT: PASSED"
else
    echo "RESULT: FAILED ($fails)"
fi
exit "$fails"
