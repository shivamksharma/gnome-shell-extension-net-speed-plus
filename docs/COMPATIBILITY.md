# Compatibility

Net Speed Plus is a single code base that is built into two packages:

- **Legacy** — GNOME Shell 42–44 (legacy `imports.*` modules).
- **Modern** — GNOME Shell 45–50 (ES modules). GNOME 51 is expected to work and
  is scheduled for release on 2026-09-16, but is not declared until it ships.

The two packages share `src/core/` and `src/shell/`; only the entry points and
the preferences UI differ.

## Definitions

- **Supported** — the implementation is intentionally built and declared for
  that GNOME Shell version.
- **Tested** — the package was actually executed and observed to work on that
  GNOME Shell version, and the evidence is recorded below.
- **Untested** — no runtime execution has been performed in this environment.

A version is never marked *Tested* without recorded evidence.

## Matrix

| GNOME | Implementation | Supported | Tested | Evidence |
| --- | --- | --- | --- | --- |
| 41 | — | No | No | GNOME 41 preferences use GTK3; this project targets 42+ |
| 42 | Legacy | Yes | Yes | GNOME Shell 42.9: enabled, disabled, and re-enabled 3× with no error |
| 43 | Legacy | Yes | No | Same target as 42; not available here |
| 44 | Legacy | Yes | No | Same target as 42; not available here |
| 45 | Modern | Yes | No | Supersedes the previously accepted EGO v3 (45–49) |
| 46 | Modern | Yes | No | No GNOME 45+ session available here |
| 47 | Modern | Yes | No | No GNOME 45+ session available here |
| 48 | Modern | Yes | No | No GNOME 45+ session available here |
| 49 | Modern | Yes | No | No GNOME 45+ session available here |
| 50 | Modern | Yes | No | No breaking changes to the APIs used (see below) |
| 51 | Modern | No | No | Not released at the time of this audit (due 2026-09-16) |

## Evidence

### GNOME 42.9 (legacy)

Environment: Pop!\_OS 22.04, GNOME Shell 42.9, GJS 1.72.4, X11.

A private headless GNOME Shell session (isolated `XDG_*` directories, in-memory
GSettings backend) was started with the legacy package installed. Using the
`org.gnome.Shell.Extensions` D-Bus interface, the extension reached
`state: ENABLED` with an empty `error` field through three enable/disable
cycles. The live `/proc/net/dev` integration test also detected the real Wi-Fi
interface and produced a valid byte/second sample.

### Static validation (all versions)

`./scripts/validate.sh` parses every source file, compiles the GSettings schema
strictly, rejects synchronous subprocesses and deprecated modules, verifies
transpiled output and import resolution, and inspects both packages.

## GNOME 45–51 API review (50 declared, 51 pending)

The APIs used by the modern package are unchanged across these releases:

- `Extension`, `ExtensionPreferences`, `getSettings()`.
- `PanelMenu.Button`, `St.Label`, `GObject.registerClass`,
  `St.BoxLayout`/`add_child`.
- `GLib.timeout_add`, `Gio.File.load_contents_async`, `Gio.NetworkMonitor`.
- `Adw.PreferencesPage`, `Adw.PreferencesGroup`, `Adw.SwitchRow`,
  `Adw.ComboRow` (libadwaita ≥ 1.4, shipped with GNOME 45+).

Per the upgrade guides, GNOME 51 will require `disable()` to be synchronous (it
already is), and GNOME 48–51 deprecate/remove the `St` `vertical` property and
some event signals that this extension does not use. GNOME 51 should therefore
be declared once it is released and confirmed on EGO.

## EGO history

| EGO version | Shell versions | Status | Notes |
| --- | --- | --- | --- |
| 1 | 42, 43, 44 | Rejected | Sync subprocess, deprecated modules, name clash |
| 2 | 45, 46, 47, 48, 49 | Rejected | Shipped `gschemas.compiled`, manual signal cleanup |
| 3 | 45, 46, 47, 48, 49 | Active | Async I/O, `connectObject`, Adw preferences |

The UUID `netspeed@shivamksharma.github.io` is preserved from the published
extension so existing installations keep receiving updates.

## Building per version

```bash
./scripts/build-legacy.sh    # metadata shell-version: 42, 43, 44  (version 5)
./scripts/build-modern.sh    # metadata shell-version: 45..51      (version 4)
```

EGO accepts one shell-version range per uploaded version, so the legacy and
modern packages are uploaded as separate versions of the same extension UUID.
