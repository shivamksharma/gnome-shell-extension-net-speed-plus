const RX_BYTES_INDEX = 0;
const TX_BYTES_INDEX = 8;
const COUNTER_COUNT = 16;

export function parseProcNetDev(text) {
    const interfaces = new Map();

    if (typeof text !== 'string' || text.length === 0)
        return interfaces;

    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (line.length === 0)
            continue;

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1)
            continue;

        const iface = line.slice(0, colonIndex).trim();
        if (iface.length === 0)
            continue;

        const fields = line.slice(colonIndex + 1).trim().split(/\s+/);
        if (fields.length < COUNTER_COUNT)
            continue;

        const rx = Number.parseInt(fields[RX_BYTES_INDEX], 10);
        const tx = Number.parseInt(fields[TX_BYTES_INDEX], 10);
        if (!Number.isFinite(rx) || !Number.isFinite(tx))
            continue;

        interfaces.set(iface, { rx, tx });
    }

    return interfaces;
}
