import test from 'node:test';
import assert from 'node:assert/strict';

import { convert } from '../scripts/lib/esm2legacy.mjs';

test('converts gi:// default imports', () => {
    assert.equal(convert("import GLib from 'gi://GLib';", 'shell/procfs.js'), 'const GLib = imports.gi.GLib;');
});

test('converts resource:// namespace imports', () => {
    assert.equal(
        convert("import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';", 'shell/indicator.js'),
        'const PanelMenu = imports.ui.panelMenu;'
    );
});

test('converts relative named imports to dotted module paths', () => {
    assert.equal(
        convert("import { formatSpeed } from '../core/formatter.js';", 'shell/indicator.js'),
        'const { formatSpeed } = imports.core.formatter;'
    );
    assert.equal(
        convert("import { readTextFileAsync } from './procfs.js';", 'shell/networkMonitor.js'),
        'const { readTextFileAsync } = imports.shell.procfs;'
    );
});

test('collapses multi-line named imports', () => {
    const source = [
        'import {',
        '    SETTINGS,',
        '    PANEL_NAME,',
        "} from '../core/constants.js';",
        '',
        'const x = 1;',
    ].join('\n');

    assert.equal(
        convert(source, 'shell/indicator.js'),
        'const { SETTINGS, PANEL_NAME, } = imports.core.constants;\n\nconst x = 1;'
    );
});

test('converts exports to legacy declarations', () => {
    assert.equal(convert('export function a() {}', 'core/a.js'), 'function a() {}');
    assert.equal(convert('export async function b() {}', 'core/a.js'), 'async function b() {}');
    assert.equal(convert('export const c = 1;', 'core/a.js'), 'var c = 1;');
    assert.equal(convert('export class D {}', 'core/a.js'), 'var D = class D {}');
});

test('rejects unsupported syntax', () => {
    assert.throws(() => convert('export default class E {}', 'core/a.js'));
    assert.throws(() => convert("import { a } from 'https://example.com/a.js';", 'core/a.js'));
    assert.throws(() => convert("import { a } from '../../escape.js';", 'core/a.js'));
});
