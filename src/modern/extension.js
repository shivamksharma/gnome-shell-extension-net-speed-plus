import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { PANEL_ROLE } from '../core/constants.js';
import { NetSpeedIndicator } from '../shell/indicator.js';

export default class NetSpeedPlusExtension extends Extension {
    enable() {
        this._indicator = new NetSpeedIndicator(this.getSettings());
        Main.panel.addToStatusArea(PANEL_ROLE, this._indicator, 0, 'right');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
