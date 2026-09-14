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
| Modern preferences probe | `tests/prefs-modern.probe.mjs` | Builds the real Adw preferences window with GNOME's `ExtensionPreferences` base (self-skips without GNOME 45+, a display, or libadwaita ≥ 1.4) |

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

The modern package was executed on GNOME Shell 45.10 (Fedora 39), 46.0
(Ubuntu 24.04), 47.10 (Fedora 41), 48.7 (Debian 13), 49.9 (Fedora 43), and 50.1
(Ubuntu 26.04). On GNOME Shell 46.0 with GJS 1.80.2 and libadwaita 1.5:

- headless Shell with a virtual monitor, system D-Bus, and `/run/systemd`
  removed so Shell uses its dummy login manager;
- the package enabled, disabled, and re-enabled three times with an empty error
  state;
- `tests/core.test.mjs` (44) and `tests/modern-network.test.mjs` (5) passed
  under the container's GJS 1.80.2;
- `tests/prefs-modern.probe.mjs` built the real Adw preferences window.

This procedure can be repeated with any `ubuntu:24.04`-style image. Before
shipping, also run the full interactive smoke test on a real session:

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

## Reusable container harness (GNOME 42–50)

`tests/container/` contains a generic harness that runs the enable/disable
runtime test in a Docker container. Containers are created once and reused for
any extension.

### GNOME version → distribution → container used here

| GNOME Shell | Distribution image | Container | Package generation |
| --- | --- | --- | --- |
| 42.9 | host Pop!\_OS 22.04 (no container) | — | legacy |
| 43.9 | `debian:12` | `gnome43` | legacy |
| 44.3 | `ubuntu:23.04` (old-releases) | `gnome44` | legacy |
| 45.10 | `fedora:39` | `gnome45` | modern |
| 46.0 | `ubuntu:24.04` | `gnome46` | modern |
| 47.10 | `fedora:41` | `gnome47` | modern |
| 48.7 | `debian:13` | `gnome48` | modern |
| 49.9 | `fedora:43` | `gnome49` | modern |
| 50.1 | `ubuntu:26.04` | `gnome50` | modern |

GNOME 51 was not tested (not released yet). The setup script handles both `apt`
and `dnf`, and end-of-life Ubuntu images via the old-releases mirror, so any
image can be added.

### Create a container (reusable)

```bash
./tests/container/setup-container.sh <image> <container-name>

# examples
./tests/container/setup-container.sh debian:12    gnome43
./tests/container/setup-container.sh ubuntu:23.04 gnome44
./tests/container/setup-container.sh ubuntu:24.04 gnome46
./tests/container/setup-container.sh debian:13    gnome48
./tests/container/setup-container.sh ubuntu:26.04 gnome50
```

The script installs `gnome-shell`, D-Bus, GL software rendering, and schema
tools, then leaves the container **running** (it never deletes it).

### Run the runtime test for any extension

```bash
./tests/container/run-extension-test.sh <container> <package.zip> <uuid>

# example: a different extension on GNOME 46
./tests/container/run-extension-test.sh gnome46 /path/to/other-extension.zip \
    other-uuid@example.com
```

It installs the zip into an isolated `XDG_DATA_HOME` inside the container,
starts a headless GNOME Shell with a virtual monitor, and enables/disables the
extension three times through the `org.gnome.Shell.Extensions` D-Bus interface.
The container is left untouched for reuse.

Two details make headless Shell work in a container:

- a system D-Bus is started (`dbus-daemon --system`) so Shell can resolve
  system services;
- `/run/systemd` is removed so `haveSystemd()` is false and Shell uses its dummy
  login manager instead of failing on the missing logind.

## What was actually executed

| Date | Environment | Result |
| --- | --- | --- |
| Audit | Pop!\_OS 22.04, GNOME Shell 42.9, GJS 1.72.4 | `tests/run.sh`: 74 checks (6 transpiler, 44 core, 5 modern, 11 legacy, 8 preferences); `validate.sh` clean; headless Shell 42.9 3× enable/disable with no error |
| Audit | Containers: GNOME Shell 43.9, 44.3, 45.10, 46.0, 47.10, 48.7, 49.9, 50.1 | Each package enabled/disabled/re-enabled 3× with an empty error state |
| Audit | Ubuntu 24.04 container, GNOME Shell 46.0, GJS 1.80.2, libadwaita 1.5 | Core 44/44 and modern live 5/5 under GJS 1.80.2; `prefs-modern.probe.mjs` built the Adw window |
| CI | GitHub Actions, Ubuntu latest | `validate.sh` + `tests/run.sh` green on `main` |
