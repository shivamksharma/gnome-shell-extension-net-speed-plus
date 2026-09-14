// Test stub: stands in for the GNOME Shell `imports.misc.extensionUtils`
// module so the legacy preferences can be built outside of GNOME Shell.
const Gio = imports.gi.Gio;

var getSettings = function () {
    return new Gio.Settings({
        schema_id: 'org.gnome.shell.extensions.netspeed_plus',
    });
};
