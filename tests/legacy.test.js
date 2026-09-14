// Legacy GJS integration test for the transpiled GNOME 42-44 modules.
// Run with: gjs tests/legacy.test.js
imports.searchPath.unshift('build/legacy');

const GLib = imports.gi.GLib;

let failures = 0;
let checks = 0;

function check(actual, expected, message) {
    checks++;
    if (actual !== expected) {
        failures++;
        print(`FAIL: ${message}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    }
}

function runAsync(fn) {
    const loop = GLib.MainLoop.new(null, false);
    let error = null;

    fn().then(
        () => loop.quit(),
        e => {
            error = e;
            loop.quit();
        }
    );

    loop.run();
    if (error)
        throw error;
}

const { formatSpeed, formatDisplayText } = imports.core.formatter;
const { parseProcNetDev } = imports.core.procNetDev;
const { createSpeedSampler } = imports.core.sampler;
const { createNetworkMonitor } = imports.shell.networkMonitor;

check(formatSpeed(0, 0), '0 B/s', 'legacy formatter zero');
check(formatSpeed(1024, 0), '1.0 KB/s', 'legacy formatter KiB');
check(formatDisplayText(2048, 1024, true, true, 0), '\u2193 2.0 KB/s  \u2191 1.0 KB/s', 'legacy display text');

const parsed = parseProcNetDev('  eth0: 5000 10 0 0 0 0 0 0 7000 10 0 0 0 0 0 0');
check(parsed.get('eth0').rx, 5000, 'legacy parser rx');
check(parsed.get('eth0').tx, 7000, 'legacy parser tx');

const sampler = createSpeedSampler();
check(sampler.sample('eth0', 1000, 1000, 0).valid, false, 'legacy sampler baseline');
check(sampler.sample('eth0', 3000, 2500, 1_000_000).rx, 2000, 'legacy sampler speed');

runAsync(async () => {
    const monitor = createNetworkMonitor();
    monitor.start();

    const first = await monitor.sample();
    check(typeof first.rx, 'number', 'live sample rx is a number');
    check(first.valid, false, 'first live sample is baseline');

    await new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });

    const second = await monitor.sample();
    check(typeof second.rx, 'number', 'second live sample rx is a number');
    check(second.rx >= 0 && second.tx >= 0, true, 'second live sample is non-negative');
    print(`- live interface: ${second.iface ?? 'none'}`);

    monitor.stop();
});

print(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0)
    throw new Error(`${failures} check(s) failed`);
