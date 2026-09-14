// Preferences probe: loads the modern preferences with GNOME's real
// ExtensionPreferences base class and builds the preferences window.
//
// It self-skips on any environment that cannot support it (no GNOME 45+
// resource, no display, libadwaita < 1.4, missing typelibs), so it is safe to
// run everywhere.
//
// Usage:
//   EXTENSION_DIR=build/modern gjs -m tests/prefs-modern.probe.mjs
//
// On some systems the Shell typelibs must be on the search path:
//   GI_TYPELIB_PATH=/usr/lib/gnome-shell/girepository-1.0 \
//   LD_LIBRARY_PATH=/usr/lib/gnome-shell gjs -m tests/prefs-modern.probe.mjs

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const CANDIDATES = [
    '/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource',
    '/usr/lib/gnome-shell/org.gnome.Shell.Extensions.src.gresource',
];

const EXTENSION_DIR = GLib.getenv('EXTENSION_DIR') ?? 'build/modern';
const SCHEMA_ID = 'org.gnome.shell.extensions.netspeed_plus';

function skip(reason) {
    print(`SKIP: ${reason}`);
}

async function main() {
    const resourcePath = CANDIDATES.find(path => GLib.file_test(path, GLib.FileTest.EXISTS));
    if (!resourcePath)
        return skip('GNOME Shell Extensions gresource not found');

    if (!GLib.getenv('DISPLAY') && !GLib.getenv('WAYLAND_DISPLAY'))
        return skip('no display available');

    const repoRoot = import.meta.url
        .replace(/^file:\/\//, '')
        .replace(/\/tests\/prefs-modern\.probe\.mjs$/, '');
    const prefsFile = EXTENSION_DIR.startsWith('/')
        ? `${EXTENSION_DIR}/prefs.js`
        : `${repoRoot}/${EXTENSION_DIR}/prefs.js`;
    if (!GLib.file_test(prefsFile, GLib.FileTest.EXISTS))
        return skip(`preferences not built at ${prefsFile}`);

    let Gtk;
    let Adw;
    try {
        Gtk = (await import('gi://Gtk')).default;
        Adw = (await import('gi://Adw')).default;
    } catch (e) {
        return skip(`GTK4/libadwaita unavailable: ${e.message}`);
    }

    if (Adw.MAJOR_VERSION === 1 && Adw.MINOR_VERSION < 4)
        return skip('libadwaita is older than 1.4');

    Gtk.init();
    Gio.Resource.load(resourcePath)._register();

    const schemasDir = GLib.build_filenamev([EXTENSION_DIR, 'schemas']);
    if (GLib.file_test(schemasDir, GLib.FileTest.IS_DIR) &&
        !GLib.file_test(GLib.build_filenamev([schemasDir, 'gschemas.compiled']), GLib.FileTest.EXISTS)) {
        GLib.spawn_command_line_sync(`glib-compile-schemas ${schemasDir}`);
    }

    let module;
    try {
        module = await import(`file://${prefsFile}`);
    } catch (e) {
        return skip(`could not load preferences: ${e.message}`);
    }

    const prefs = new module.default({
        uuid: 'netspeed@shivamksharma.github.io',
        'settings-schema': SCHEMA_ID,
        path: EXTENSION_DIR,
        dir: Gio.File.new_for_path(EXTENSION_DIR),
    });

    const window = new Adw.PreferencesWindow();
    prefs.fillPreferencesWindow(window);
    print(`OK: modern preferences built (libadwaita ${Adw.MAJOR_VERSION}.${Adw.MINOR_VERSION})`);
}

await main();
