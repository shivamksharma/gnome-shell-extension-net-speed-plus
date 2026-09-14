const RTF_UP = 0x1;

function lowestMetric(candidates) {
    if (candidates.length === 0)
        return null;

    candidates.sort((a, b) => a.metric - b.metric);
    return candidates[0].iface;
}

export function parseProcNetRoute(text) {
    const candidates = [];

    if (typeof text !== 'string' || text.length === 0)
        return null;

    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (line.length === 0)
            continue;

        const fields = line.split(/\s+/);
        if (fields.length < 8)
            continue;

        const [iface, destination, gateway, flags, refcnt, use, metric, mask] = fields;

        if (destination !== '00000000' || mask !== '00000000')
            continue;

        const flagBits = Number.parseInt(flags, 16);
        if (!Number.isFinite(flagBits) || (flagBits & RTF_UP) === 0)
            continue;

        candidates.push({ iface, metric: Number.parseInt(metric, 10) || 0 });
    }

    return lowestMetric(candidates);
}

export function parseProcNetIpv6Route(text) {
    const candidates = [];

    if (typeof text !== 'string' || text.length === 0)
        return null;

    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (line.length === 0)
            continue;

        const fields = line.split(/\s+/);
        if (fields.length < 10)
            continue;

        const [destination, destinationPrefix, , , , metric, , , , iface] = fields;

        if (destination !== '00000000000000000000000000000000' || destinationPrefix !== '00')
            continue;

        candidates.push({ iface, metric: Number.parseInt(metric, 16) || 0 });
    }

    return lowestMetric(candidates);
}
