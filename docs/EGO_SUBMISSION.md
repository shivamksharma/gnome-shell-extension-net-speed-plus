# EGO submission checklist

One UUID, two packages. Upload each package as a separate version of the same
extension; EGO maps each version to its own shell-version range.

- UUID: `netspeed@shivamksharma.github.io`
- Settings schema: `org.gnome.shell.extensions.netspeed_plus`

## 1. Build

```bash
./scripts/build-all.sh
./scripts/validate.sh
./tests/run.sh
```

Expected output:

```
dist/net-speed-plus-modern-v4.shell-extension.zip   # shell-version 45..50, version 4
dist/net-speed-plus-legacy-v5.shell-extension.zip   # shell-version 42..44, version 5
```

## 2. Pre-flight

- [ ] `metadata.json` UUID is `netspeed@shivamksharma.github.io`.
- [ ] `schema` id and `settings-schema` match.
- [ ] No `gschemas.compiled` in either zip.
- [ ] No development files (`scripts/`, `tests/`, `.github/`) in either zip.
- [ ] `https://github.com/shivamksharma/gnome-shell-extension-net-speed-plus`
      resolves.
- [ ] Modern package smoke-tested on GNOME 45+ (see `docs/TESTING.md`).
- [ ] Legacy package smoke-tested on GNOME 42–44.

## 3. Upload order

EGO requires a version number greater than the currently active one (3).

1. Upload `net-speed-plus-modern-v4.shell-extension.zip` (version 4, 45–50).
2. Upload `net-speed-plus-legacy-v5.shell-extension.zip` (version 5, 42–44).

If EGO rejects a shell version that is not yet in its database (for example 50
before release), remove it from the `shell-version` array, rebuild, and add it
again after release.

## 4. After publishing

- [ ] Confirm the extension appears for each declared shell version.
- [ ] Install from EGO on a clean profile and run the smoke tests.
- [ ] Watch the review comments and address any requests.
- [ ] Update `README.md` and `docs/COMPATIBILITY.md` if the tested matrix
      changes.

## Notes

- Do not change the UUID; it preserves updates for existing installations.
- Do not ship `schemas/gschemas.compiled` for the 45+ package.
- Keep the legacy and modern packages free of each other's module syntax.
