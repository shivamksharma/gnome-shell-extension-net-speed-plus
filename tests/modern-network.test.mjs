// Live integration test for the modern (GNOME 45+) shell modules as ES modules.
// Exercises the exact modern /proc pipeline (async GIO reads, route parsing,
// interface selection, and speed sampling).
import GLib from 'gi://GLib';

import { createNetworkMonitor } from '../src/shell/networkMonitor.js';

let failures = 0;
let checks = 0;

function check(actual, expected, message) {
    checks++;
    if (actual !== expected) {
        failures++;
        print(`FAIL: ${message}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    }
}

function delay(milliseconds) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

const monitor = createNetworkMonitor();
monitor.start();

const first = await monitor.sample();
check(typeof first.rx, 'number', 'first modern sample rx is a number');
check(typeof first.tx, 'number', 'first modern sample tx is a number');
check(first.valid, false, 'first modern sample is a baseline');

await delay(300);

const second = await monitor.sample();
check(typeof second.rx, 'number', 'second modern sample rx is a number');
check(second.rx >= 0 && second.tx >= 0, true, 'second modern sample is non-negative');
print(`- live interface: ${second.iface ?? 'none'}`);

monitor.stop();

print(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0)
    throw new Error(`${failures} check(s) failed`);
