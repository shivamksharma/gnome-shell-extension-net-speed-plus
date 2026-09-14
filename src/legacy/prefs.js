const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;

function labeledRow(title, subtitle, control) {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        margin_top: 6,
        margin_bottom: 6,
        margin_start: 12,
        margin_end: 12,
    });

    const text = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        hexpand: true,
        valign: Gtk.Align.CENTER,
    });
    text.append(new Gtk.Label({ label: title, halign: Gtk.Align.START }));
    if (subtitle)
        text.append(new Gtk.Label({
            label: subtitle,
            halign: Gtk.Align.START,
            css_classes: ['dim-label'],
        }));

    control.valign = Gtk.Align.CENTER;
    box.append(text);
    box.append(control);

    return box;
}

function labeledGroup(title, rows) {
    const frame = new Gtk.Frame({ label: title });
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 6,
        margin_bottom: 6,
    });

    for (const row of rows)
        box.append(row);

    frame.set_child(box);
    return frame;
}

function buildPrefsWidget() {
    const settings = ExtensionUtils.getSettings();

    const mainBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 18,
        margin_top: 24,
        margin_bottom: 24,
        margin_start: 24,
        margin_end: 24,
    });

    const downloadSwitch = new Gtk.Switch({ active: settings.get_boolean('show-download') });
    settings.bind('show-download', downloadSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

    const uploadSwitch = new Gtk.Switch({ active: settings.get_boolean('show-upload') });
    settings.bind('show-upload', uploadSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

    mainBox.append(labeledGroup('Display', [
        labeledRow('Show download speed', 'Display the download speed (\u2193)', downloadSwitch),
        labeledRow('Show upload speed', 'Display the upload speed (\u2191)', uploadSwitch),
    ]));

    const unitChoices = [0, 1, 2];
    const unitDrop = new Gtk.DropDown({
        model: Gtk.StringList.new(['Auto (B/s, KB/s, MB/s, GB/s)', 'KB/s only', 'MB/s only']),
        selected: Math.max(0, unitChoices.indexOf(settings.get_int('unit-mode'))),
    });
    unitDrop.connect('notify::selected', () => {
        settings.set_int('unit-mode', unitChoices[unitDrop.selected]);
    });

    mainBox.append(labeledGroup('Units', [
        labeledRow('Unit mode', 'Format speeds automatically or with a fixed unit', unitDrop),
    ]));

    let intervalChoices = [0.5, 1, 2, 5, 10];
    const currentInterval = settings.get_double('update-interval');
    const clampedInterval = Math.min(10, Math.max(0.5, currentInterval));
    if (!intervalChoices.includes(clampedInterval))
        intervalChoices = [...intervalChoices, clampedInterval].sort((a, b) => a - b);

    const intervalDrop = new Gtk.DropDown({
        model: Gtk.StringList.new(intervalChoices.map(seconds => `${seconds} s`)),
        selected: intervalChoices.indexOf(clampedInterval),
    });
    intervalDrop.connect('notify::selected', () => {
        settings.set_double('update-interval', intervalChoices[intervalDrop.selected]);
    });

    mainBox.append(labeledGroup('Update interval', [
        labeledRow('Refresh rate', 'Shorter intervals use more CPU and battery', intervalDrop),
    ]));

    return mainBox;
}
