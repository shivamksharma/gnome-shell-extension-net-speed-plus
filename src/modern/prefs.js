import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    SETTINGS,
    UNIT_MODE,
    UPDATE_INTERVAL_MIN,
    UPDATE_INTERVAL_MAX,
} from '../core/constants.js';

const INTERVAL_CHOICES = [0.5, 1, 2, 5, 10];

function selectionIndex(list, value) {
    const item = list.indexOf(value);
    return item === -1 ? 0 : item;
}

function makeComboRow(title, subtitle, labels, selectedIndex, onSelected) {
    const row = new Adw.ComboRow({
        title,
        subtitle,
        model: Gtk.StringList.new(labels),
    });

    row.selected = selectedIndex;
    row.connect('notify::selected', () => onSelected(row.selected));
    return row;
}

export default class NetSpeedPlusPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        const displayGroup = new Adw.PreferencesGroup({
            title: 'Display',
            description: 'Choose which speeds to show in the panel',
        });
        page.add(displayGroup);

        const downloadRow = new Adw.SwitchRow({
            title: 'Show download speed',
            subtitle: 'Display the download speed (\u2193)',
        });
        settings.bind(SETTINGS.SHOW_DOWNLOAD, downloadRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(downloadRow);

        const uploadRow = new Adw.SwitchRow({
            title: 'Show upload speed',
            subtitle: 'Display the upload speed (\u2191)',
        });
        settings.bind(SETTINGS.SHOW_UPLOAD, uploadRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(uploadRow);

        const unitGroup = new Adw.PreferencesGroup({
            title: 'Units',
            description: 'Speed values use binary units (1 KB/s = 1024 B/s)',
        });
        page.add(unitGroup);

        const unitChoices = [UNIT_MODE.AUTO, UNIT_MODE.KB, UNIT_MODE.MB];
        unitGroup.add(makeComboRow(
            'Unit mode',
            'Format speeds automatically or with a fixed unit',
            ['Auto (B/s, KB/s, MB/s, GB/s)', 'KB/s only', 'MB/s only'],
            selectionIndex(unitChoices, settings.get_int(SETTINGS.UNIT_MODE)),
            selected => settings.set_int(SETTINGS.UNIT_MODE, unitChoices[selected])
        ));

        const intervalGroup = new Adw.PreferencesGroup({
            title: 'Update interval',
            description: 'Shorter intervals use more CPU and battery',
        });
        page.add(intervalGroup);

        let intervalChoices = INTERVAL_CHOICES;
        const currentInterval = settings.get_double(SETTINGS.UPDATE_INTERVAL);
        const clampedInterval = Math.min(UPDATE_INTERVAL_MAX, Math.max(UPDATE_INTERVAL_MIN, currentInterval));
        if (!intervalChoices.includes(clampedInterval))
            intervalChoices = [...intervalChoices, clampedInterval].sort((a, b) => a - b);

        intervalGroup.add(makeComboRow(
            'Refresh rate',
            'How often the displayed speed is updated',
            intervalChoices.map(seconds => `${seconds} s`),
            intervalChoices.indexOf(clampedInterval),
            selected => settings.set_double(SETTINGS.UPDATE_INTERVAL, intervalChoices[selected])
        ));

        const aboutGroup = new Adw.PreferencesGroup({ title: 'About' });
        page.add(aboutGroup);
        aboutGroup.add(new Adw.ActionRow({
            title: 'Net Speed Plus',
            subtitle: 'Real-time network speed indicator for GNOME Shell',
        }));

        window.set_default_size(480, 560);
    }
}
