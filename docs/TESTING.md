# Testing

## Automated suites

Run everything with:

```bash
./tests/run.sh
```

| Suite | File | What it covers |
| --- | --- | --- |
| Transpiler unit | `tests/transpiler.test.mjs` | `esm2legacy.mjs` conversions and rejections (Node test runner) |
| Core unit | `tests/core.test.mjs` | Formatter (B/s…GB/s, fixed units, hidden values), `/proc/net/dev` parser, IPv4/IPv6 default-route parsers, interface selection, speed sampler (baseline, reset, interface change, zero delta) |
| Modern live pipeline | `tests/modern-network.test.mjs` | The exact modern ES-module stack reading real `/proc` files asynchronously |
| Legacy integration | `tests/legacy.test.js` | The transpiled GNOME 42–44 modules, including a live `/proc/net/dev` sample |
| Legacy preferences | `tests/prefs-legacy.test.js` | Builds the real GTK4 preferences widget and verifies switches/dropdowns write to GSettings (skips without a display or GTK4 introspection data) |

Static checks and packaging:

```bash
./scripts/validate.sh
```

## Continuous integration

`.github/workflows/ci.yml` runs `scripts/validate.sh`, `tests/run.sh`, and
uploads the built packages on every push and pull request. The preferences test
skips on the headless runner.

## Manual runtime smoke test — GNOME 42–44 (legacy)

The procedure below is what was used to verify GNOME Shell 42.9. It starts a
private, headless GNOME Shell so the running desktop is untouched.

```bash
./scripts/build-legacy.sh

TMP="$(mktemp -d)"
export XDG_CONFIG_HOME="$TMP/config" XDG_DATA_HOME="$TMP/data" \
       XDG_CACHE_HOME="$TMP/cache" XDG_RUNTIME_DIR="$TMP/run" \
       GSETTINGS_BACKEND=memory
mkdir -p "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$XDG_CACHE_HOME" "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

EXT="$XDG_DATA_HOME/gnome-shell/extensions/netspeed@shivamksharma.github.io"
mkdir -p "$EXT"
unzip -q dist/net-speed-plus-legacy-v5.shell-extension.zip -d "$EXT"
glib-compile-schemas "$EXT/schemas"

dbus-run-session -- bash -c '
  gnome-shell --headless --virtual-monitor 1024x768 &
  sleep 8
  gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
    --method org.gnome.Shell.Extensions.EnableExtension netspeed@shivamksharma.github.io
  sleep 2
  gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
    --method org.gnome.Shell.Extensions.GetExtensionInfo netspeed@shivamksharma.github.io
  kill %1
'
```

The extension must report `state: 1` (ENABLED) with an empty `error` field.
Repeat the enable/disable cycle to check for leaks. **Never run `dconf write`
against the real session during testing** — use an isolated `XDG_CONFIG_HOME`
and `GSETTINGS_BACKEND=memory` as above.

## Manual runtime smoke test — GNOME 45+ (modern)

This environment could only run GNOME 42, so the modern package has **not** been
executed. Before shipping, verify it on a GNOME 45+ session:

1. `./scripts/build-modern.sh`
2. `gnome-extensions install --force dist/net-speed-plus-modern-v4.shell-extension.zip`
3. Log out and back in, then enable the extension.
4. Confirm the panel shows `↓ … ↑ …` and the values change with network traffic.
5. Open preferences and toggle download/upload, unit mode, and refresh rate.
6. Switch between Wi-Fi and Ethernet; confirm no stale value or spike.
7. Toggle a VPN on and off; confirm the monitored interface follows the default
   route.
8. Disable and re-enable the extension several times; confirm there is only one
   indicator and no errors in `journalctl -f -o cat /usr/bin/gnome-shell`.

## What was actually executed

| Date | Environment | Result |
| --- | --- | --- |
| Audit | Pop!\_OS 22.04, GNOME Shell 42.9, GJS 1.72.4 | `tests/run.sh`: 74 checks (6 transpiler, 44 core, 5 modern, 11 legacy, 8 preferences); `validate.sh` clean; headless Shell 42.9 3× enable/disable with no error |
| Audit | Same | Modern 45–50 package: static validation and import resolution only |
