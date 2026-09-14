const NEVER_DEFAULT = new Set(['lo']);

export function isUsableInterface(iface) {
    return typeof iface === 'string' && iface.length > 0 && !NEVER_DEFAULT.has(iface);
}

export function selectActiveInterface({ ipv4Default, ipv6Default, counters }) {
    const hasCounters = counters && typeof counters.has === 'function';

    for (const [candidate, source] of [
        [ipv4Default, 'ipv4-default-route'],
        [ipv6Default, 'ipv6-default-route'],
    ]) {
        if (isUsableInterface(candidate) && (!hasCounters || counters.has(candidate)))
            return { iface: candidate, source };
    }

    return { iface: null, source: 'none' };
}
