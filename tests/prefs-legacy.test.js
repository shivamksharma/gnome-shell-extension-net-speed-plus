// Builds the real GNOME 42-44 preferences widget outside of GNOME Shell using
// a stub for imports.misc.extensionUtils, then verifies that interacting with
// the widgets updates GSettings.
//
// Run with: gjs tests/prefs-legacy.test.js
// Requires a display (skipped otherwise) and GSETTINGS_SCHEMA_DIR.
imports.searchPath.unshift('tests/support');
imports.searchPath.unshift('build/legacy');

imports.gi.versions.Gtk = '4.0';

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

let Gtk = null;
try {
    Gtk = imports.gi.Gtk;
} catch (e) {
    Gtk = null;
}

let failures = 0;
let checks = 0;

function check(actual, expected, message) {
    checks++;
    if (actual !== expected) {
        failures++;
        print(`FAIL: ${message}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    }
}

if (!Gtk) {
    print('SKIP: GTK4 introspection data is not available');
} else if (!GLib.getenv('DISPLAY') && !GLib.getenv('WAYLAND_DISPLAY')) {
    print('SKIP: no display available for the GTK4 preferences test');
} else {
    Gtk.init();

    const prefs = imports.prefs;
    const widget = prefs.buildPrefsWidget();

    check(widget instanceof Gtk.Box, true, 'buildPrefsWidget returns a Gtk.Box');
    check(widget.get_first_child() !== null, true, 'preferences box has children');

    function collect(node, type, out) {
        for (let child = node.get_first_child(); child; child = child.get_next_sibling()) {
            if (child instanceof type)
                out.push(child);
            collect(child, type, out);
        }
        return out;
    }

    const switches = collect(widget, Gtk.Switch, []);
    const dropdowns = collect(widget, Gtk.DropDown, []);
    check(switches.length >= 2, true, 'found download and upload switches');
    check(dropdowns.length >= 2, true, 'found unit and interval dropdowns');

    const settings = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.netspeed_plus' });

    const download = settings.get_boolean('show-download');
    switches[0].active = !download;
    check(settings.get_boolean('show-download'), !download, 'download switch writes to settings');

    const upload = settings.get_boolean('show-upload');
    switches[1].active = !upload;
    check(settings.get_boolean('show-upload'), !upload, 'upload switch writes to settings');

    const unitDrop = dropdowns[0];
    unitDrop.selected = 2;
    check(settings.get_int('unit-mode'), 2, 'unit dropdown writes to settings');

    const intervalDrop = dropdowns[1];
    intervalDrop.selected = 0;
    check(settings.get_double('update-interval'), 0.5, 'interval dropdown writes to settings');
}

print(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0)
    throw new Error(`${failures} check(s) failed`);
