function zeroSample() {
    return { rx: 0, tx: 0, valid: false, iface: null };
}

export function createSpeedSampler() {
    let base = null;

    function rebaseline(iface, rx, tx, nowMicros) {
        base = { iface, rx, tx, time: nowMicros };
    }

    return {
        reset() {
            base = null;
        },

        sample(iface, rx, tx, nowMicros) {
            if (iface == null) {
                base = null;
                return zeroSample();
            }

            if (base === null || base.iface !== iface) {
                rebaseline(iface, rx, tx, nowMicros);
                return { ...zeroSample(), iface };
            }

            const elapsedMicros = nowMicros - base.time;
            if (!(elapsedMicros > 0)) {
                rebaseline(iface, rx, tx, nowMicros);
                return { ...zeroSample(), iface };
            }

            const rxDelta = rx - base.rx;
            const txDelta = tx - base.tx;

            if (rxDelta < 0 || txDelta < 0) {
                rebaseline(iface, rx, tx, nowMicros);
                return { ...zeroSample(), iface };
            }

            const elapsedSeconds = elapsedMicros / 1_000_000;
            base.rx = rx;
            base.tx = tx;
            base.time = nowMicros;

            return {
                rx: rxDelta / elapsedSeconds,
                tx: txDelta / elapsedSeconds,
                valid: true,
                iface,
            };
        },
    };
}
