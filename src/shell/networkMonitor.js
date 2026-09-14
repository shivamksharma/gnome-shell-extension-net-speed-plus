import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import { parseProcNetDev } from '../core/procNetDev.js';
import { parseProcNetRoute, parseProcNetIpv6Route } from '../core/route.js';
import { selectActiveInterface } from '../core/interfaceSelector.js';
import { createSpeedSampler } from '../core/sampler.js';
import { readProcNetDevAsync, readDefaultRouteFilesAsync } from './procfs.js';

const DETECTION_INTERVAL_MICROS = 5 * 1_000_000;

export function createNetworkMonitor() {
    const sampler = createSpeedSampler();

    let iface = null;
    let forceDetection = true;
    let lastDetection = 0;

    let networkMonitor = null;
    let networkChangedId = 0;

    function onNetworkChanged() {
        forceDetection = true;
    }

    async function detectInterface(counters) {
        const { ipv4, ipv6 } = await readDefaultRouteFilesAsync();
        const selection = selectActiveInterface({
            ipv4Default: parseProcNetRoute(ipv4),
            ipv6Default: parseProcNetIpv6Route(ipv6),
            counters,
        });

        iface = selection.iface;
        lastDetection = GLib.get_monotonic_time();
        forceDetection = false;
    }

    return {
        start() {
            try {
                networkMonitor = Gio.NetworkMonitor.get_default();
                if (networkMonitor)
                    networkChangedId = networkMonitor.connect('network-changed', onNetworkChanged);
            } catch (error) {
                networkMonitor = null;
                networkChangedId = 0;
            }
        },

        async sample() {
            const now = GLib.get_monotonic_time();
            const counters = parseProcNetDev(await readProcNetDevAsync());

            const stale = now - lastDetection >= DETECTION_INTERVAL_MICROS;
            if (forceDetection || iface === null || !counters.has(iface) || stale)
                await detectInterface(counters);

            if (iface === null || !counters.has(iface)) {
                sampler.sample(null, 0, 0, now);
                return { rx: 0, tx: 0, valid: false, iface: null };
            }

            const { rx, tx } = counters.get(iface);
            return sampler.sample(iface, rx, tx, now);
        },

        stop() {
            if (networkMonitor && networkChangedId) {
                try {
                    networkMonitor.disconnect(networkChangedId);
                } catch (error) {
                    // The monitor may already be gone during session teardown.
                }
            }
            networkMonitor = null;
            networkChangedId = 0;
            sampler.reset();
            iface = null;
            forceDetection = true;
            lastDetection = 0;
        },
    };
}
