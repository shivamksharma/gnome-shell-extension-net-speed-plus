import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {
    SETTINGS,
    PANEL_NAME,
    UPDATE_INTERVAL_MIN,
    UPDATE_INTERVAL_MAX,
} from '../core/constants.js';
import { formatDisplayText } from '../core/formatter.js';
import { createNetworkMonitor } from './networkMonitor.js';

const DASH = '\u2014';

function clampInterval(seconds) {
    if (!Number.isFinite(seconds))
        return UPDATE_INTERVAL_MIN;
    return Math.min(UPDATE_INTERVAL_MAX, Math.max(UPDATE_INTERVAL_MIN, seconds));
}

export const NetSpeedIndicator = GObject.registerClass(
class NetSpeedIndicator extends PanelMenu.Button {
    _init(settings) {
        super._init(0.0, PANEL_NAME, true);

        this._settings = settings;
        this._monitor = createNetworkMonitor();
        this._timerId = 0;
        this._sampling = false;
        this._destroyed = false;
        this._last = { rx: 0, tx: 0 };

        this.accessible_name = PANEL_NAME;

        this._label = new St.Label({
            text: DASH,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'netspeed-label',
        });
        this.add_child(this._label);

        this._settings.connectObject(
            `changed::${SETTINGS.UPDATE_INTERVAL}`, () => this._onIntervalChanged(),
            `changed::${SETTINGS.UNIT_MODE}`, () => this._render(),
            `changed::${SETTINGS.SHOW_DOWNLOAD}`, () => this._render(),
            `changed::${SETTINGS.SHOW_UPLOAD}`, () => this._render(),
            this
        );

        this._monitor.start();
        this._startTimer();
        this._sample();
    }

    _startTimer() {
        if (this._timerId)
            return;

        const interval = clampInterval(this._settings.get_double(SETTINGS.UPDATE_INTERVAL));
        this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.round(interval * 1000), () => {
            this._sample();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopTimer() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
    }

    _onIntervalChanged() {
        this._stopTimer();
        this._startTimer();
    }

    async _sample() {
        if (this._destroyed || this._sampling)
            return;

        this._sampling = true;
        try {
            const sample = await this._monitor.sample();
            if (this._destroyed)
                return;

            this._last = { rx: sample.rx, tx: sample.tx };
            this._render();
        } catch (error) {
            logError(error, 'Net Speed Plus: failed to sample network speed');
        } finally {
            this._sampling = false;
        }
    }

    _render() {
        const showDownload = this._settings.get_boolean(SETTINGS.SHOW_DOWNLOAD);
        const showUpload = this._settings.get_boolean(SETTINGS.SHOW_UPLOAD);
        const unitMode = this._settings.get_int(SETTINGS.UNIT_MODE);

        this._label.set_text(
            formatDisplayText(this._last.rx, this._last.tx, showDownload, showUpload, unitMode)
        );
    }

    destroy() {
        this._destroyed = true;
        this._stopTimer();

        if (this._monitor) {
            this._monitor.stop();
            this._monitor = null;
        }

        this._settings.disconnectObject(this);

        super.destroy();
    }
});
