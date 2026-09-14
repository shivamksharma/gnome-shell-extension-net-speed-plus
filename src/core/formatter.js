import { UNIT_MODE, BYTES_PER_KIB, BYTES_PER_MIB, BYTES_PER_GIB } from './constants.js';

const DASH = '\u2014';

function sanitize(bytesPerSecond) {
    return Number.isFinite(bytesPerSecond) && bytesPerSecond > 0 ? bytesPerSecond : 0;
}

export function formatSpeed(bytesPerSecond, unitMode) {
    const bps = sanitize(bytesPerSecond);

    if (unitMode === UNIT_MODE.KB)
        return `${(bps / BYTES_PER_KIB).toFixed(1)} KB/s`;

    if (unitMode === UNIT_MODE.MB)
        return `${(bps / BYTES_PER_MIB).toFixed(2)} MB/s`;

    if (bps < BYTES_PER_KIB)
        return `${Math.round(bps)} B/s`;

    if (bps < BYTES_PER_MIB)
        return `${(bps / BYTES_PER_KIB).toFixed(1)} KB/s`;

    if (bps < BYTES_PER_GIB)
        return `${(bps / BYTES_PER_MIB).toFixed(2)} MB/s`;

    return `${(bps / BYTES_PER_GIB).toFixed(2)} GB/s`;
}

export function formatDisplayText(rxBytesPerSecond, txBytesPerSecond, showDownload, showUpload, unitMode) {
    if (!showDownload && !showUpload)
        return DASH;

    const parts = [];

    if (showDownload)
        parts.push(`\u2193 ${formatSpeed(rxBytesPerSecond, unitMode)}`);

    if (showUpload)
        parts.push(`\u2191 ${formatSpeed(txBytesPerSecond, unitMode)}`);

    return parts.join('  ');
}
