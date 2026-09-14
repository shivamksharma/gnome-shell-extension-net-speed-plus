import { UNIT_MODE } from '../src/core/constants.js';
import { formatSpeed, formatDisplayText } from '../src/core/formatter.js';
import { parseProcNetDev } from '../src/core/procNetDev.js';
import { parseProcNetRoute, parseProcNetIpv6Route } from '../src/core/route.js';
import { selectActiveInterface, isUsableInterface } from '../src/core/interfaceSelector.js';
import { createSpeedSampler } from '../src/core/sampler.js';

let failures = 0;
let checks = 0;

function check(actual, expected, message) {
    checks++;
    if (actual !== expected) {
        failures++;
        print(`FAIL: ${message}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    }
}

function group(name) {
    print(`- ${name}`);
}

group('formatter auto');
check(formatSpeed(0, UNIT_MODE.AUTO), '0 B/s', 'zero');
check(formatSpeed(100, UNIT_MODE.AUTO), '100 B/s', '100 B/s');
check(formatSpeed(999, UNIT_MODE.AUTO), '999 B/s', '999 B/s');
check(formatSpeed(1024, UNIT_MODE.AUTO), '1.0 KB/s', '1 KiB');
check(formatSpeed(999 * 1024, UNIT_MODE.AUTO), '999.0 KB/s', '999 KiB');
check(formatSpeed(1024 * 1024, UNIT_MODE.AUTO), '1.00 MB/s', '1 MiB');
check(formatSpeed(100 * 1024 * 1024, UNIT_MODE.AUTO), '100.00 MB/s', '100 MiB');
check(formatSpeed(1024 ** 3, UNIT_MODE.AUTO), '1.00 GB/s', '1 GiB');
check(formatSpeed(10 * 1024 ** 3, UNIT_MODE.AUTO), '10.00 GB/s', '10 GiB');
check(formatSpeed(NaN, UNIT_MODE.AUTO), '0 B/s', 'NaN sanitized');
check(formatSpeed(-5, UNIT_MODE.AUTO), '0 B/s', 'negative sanitized');

group('formatter fixed units');
check(formatSpeed(0, UNIT_MODE.KB), '0.0 KB/s', 'KB zero');
check(formatSpeed(1024 * 1024, UNIT_MODE.MB), '1.00 MB/s', 'MB one');

group('formatter display');
check(formatDisplayText(0, 0, false, false, UNIT_MODE.AUTO), '\u2014', 'both hidden');
check(formatDisplayText(2048, 0, true, false, UNIT_MODE.AUTO), '\u2193 2.0 KB/s', 'download only');
check(formatDisplayText(0, 2048, false, true, UNIT_MODE.AUTO), '\u2191 2.0 KB/s', 'upload only');
check(formatDisplayText(2048, 1024, true, true, UNIT_MODE.AUTO), '\u2193 2.0 KB/s  \u2191 1.0 KB/s', 'both');

group('proc/net/dev parser');
const devText = [
    'Inter-|   Receive                                                |  Transmit',
    ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
    '    lo: 1000       5    0    0    0     0          0         0     2000       5    0    0    0     0       0          0',
    '  eth0: 5000      10    0    0    0     0          0         0     7000      10    0    0    0     0       0          0',
    'malformed line without colon 1 2 3',
    '   bad: 1 2 3',
    '',
].join('\n');
const parsed = parseProcNetDev(devText);
check(parsed.size, 2, 'two interfaces parsed');
check(parsed.get('eth0').rx, 5000, 'eth0 rx');
check(parsed.get('eth0').tx, 7000, 'eth0 tx');
check(parsed.get('lo').rx, 1000, 'lo rx');
check(parseProcNetDev('').size, 0, 'empty text');
check(parseProcNetDev(null).size, 0, 'null text');

group('default route parsers');
const routeText = [
    'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT',
    'wlan0\t00000000\t0101A8C0\t0003\t0\t0\t600\t00000000\t0\t0\t0',
    'eth0\t00000000\t0101A8C0\t0003\t0\t0\t100\t00000000\t0\t0\t0',
    'eth0\t0001A8C0\t00000000\t0001\t0\t0\t0\t00FFFFFF\t0\t0\t0',
].join('\n');
check(parseProcNetRoute(routeText), 'eth0', 'lowest metric default route wins');
check(parseProcNetRoute(''), null, 'empty route table');
check(parseProcNetRoute('Iface Dest Gateway Flags RefCnt Use Metric Mask\n'), null, 'header only');

const route6Text = [
    '00000000000000000000000000000000 00 00000000000000000000000000000000 00 00000000000000000000000000000000 00000400 00000000 00000000 00000003 wg0',
].join('\n');
check(parseProcNetIpv6Route(route6Text), 'wg0', 'ipv6 default route');

group('interface selection');
check(isUsableInterface('lo'), false, 'lo unusable');
check(isUsableInterface('eth0'), true, 'eth0 usable');
const counters = new Map([['eth0', { rx: 0, tx: 0 }], ['wg0', { rx: 0, tx: 0 }]]);
check(selectActiveInterface({ ipv4Default: 'eth0', ipv6Default: 'wg0', counters }).iface, 'eth0', 'prefer ipv4');
check(selectActiveInterface({ ipv4Default: 'missing0', ipv6Default: 'wg0', counters }).iface, 'wg0', 'fallback ipv6');
check(selectActiveInterface({ ipv4Default: 'lo', ipv6Default: null, counters }).iface, null, 'lo rejected');
check(selectActiveInterface({ ipv4Default: null, ipv6Default: null, counters }).iface, null, 'no routes');

group('speed sampler');
const sampler = createSpeedSampler();
check(sampler.sample('eth0', 1000, 1000, 0).valid, false, 'first sample is baseline');
check(sampler.sample('eth0', 1000, 1000, 0).valid, false, 'zero elapsed is not valid');
let sample = sampler.sample('eth0', 3000, 2500, 1_000_000);
check(sample.valid, true, 'second sample valid');
check(sample.rx, 2000, 'rx speed');
check(sample.tx, 1500, 'tx speed');
check(sampler.sample('eth0', 1000, 500, 2_000_000).valid, false, 'counter reset rebaselines');
sample = sampler.sample('eth0', 3000, 2500, 3_000_000);
check(sample.rx, 2000, 'recovery after reset');
check(sampler.sample('wlan0', 50, 60, 4_000_000).valid, false, 'interface change is not valid');
sample = sampler.sample('wlan0', 2050, 1060, 5_000_000);
check(sample.rx, 2000, 'new interface computes fresh delta');
check(sample.tx, 1000, 'new interface tx delta');
check(sampler.sample(null, 0, 0, 6_000_000).valid, false, 'null interface');

print(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0)
    throw new Error(`${failures} check(s) failed`);
