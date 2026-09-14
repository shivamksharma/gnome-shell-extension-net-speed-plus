const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const extensionPath = Me.path || Me.dir.get_path();

if (imports.searchPath.indexOf(extensionPath) === -1)
    imports.searchPath.unshift(extensionPath);

const Main = imports.ui.main;
const { NetSpeedIndicator } = imports.shell.indicator;
const { PANEL_ROLE } = imports.core.constants;

let _indicator = null;

function enable() {
    const settings = ExtensionUtils.getSettings();
    _indicator = new NetSpeedIndicator(settings);
    Main.panel.addToStatusArea(PANEL_ROLE, _indicator, 0, 'right');
}

function disable() {
    if (_indicator) {
        _indicator.destroy();
        _indicator = null;
    }
}
