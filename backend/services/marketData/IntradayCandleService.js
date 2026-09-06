const { roundMoney } = require('../../utils/moneyUtils');

class IntradayCandleService {
    constructor() {
        // Map<symbol, Array<1m Candle>>
        this.candles1mMap = new Map();
        // Track last 1m slot index per symbol
        this.activeSlot1mMap = new Map();
    }

    /**
     * Get 09:15:00 IST for the current trading day date
     */
    getTodaySessionStart(now = new Date()) {
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(now.getTime() + istOffset);
        
        const year = istTime.getUTCFullYear();
        const month = istTime.getUTCMonth();
        const day = istTime.getUTCDate();

        // 09:15:00 IST is 03:45:00 UTC
        return new Date(Date.UTC(year, month, day, 3, 45, 0, 0));
    }

    /**
     * Get 1m slot index (0..374) for a given time relative to 09:15 IST
     */
    get1mSlotIndex(date = new Date()) {
        const sessionStart = this.getTodaySessionStart(date);
        const diffMs = date.getTime() - sessionStart.getTime();
        const oneMinMs = 60 * 1000;

        if (diffMs < 0) return 0;
        const slot = Math.floor(diffMs / oneMinMs);
        return Math.min(374, Math.max(0, slot));
    }

    /**
     * Simple deterministic pseudo-random generator based on seed
     */
    seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    /**
     * Initialize 1D simulated 1-minute session candles for an instrument
     */
    initSymbolSession(inst) {
        const symbol = (inst.symbol || '').toUpperCase().trim();
        const now = new Date();
        const sessionStart = this.getTodaySessionStart(now);
        const currentSlot = this.get1mSlotIndex(now);
        const oneMinMs = 60 * 1000;

        const refPrice = inst.referencePrice || inst.previousClose || inst.lastPrice || 100;
        const isIndex = inst.instrumentType === 'INDEX' || inst.type === 'INDEX';
        
        // Pseudo-random seed from symbol string
        let seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

        // Controlled opening gap (-0.3% to +0.3%)
        const openingGapPct = (this.seededRandom(seed++) * 2 - 1) * 0.003;
        const sessionOpen = roundMoney(refPrice * (1 + openingGapPct));

        const targetPrice = inst.lastPrice || sessionOpen;

        const candles1m = [];
        let runningPrice = sessionOpen;
        let momentum = 0;

        // Base volatility factor
        const volFactor = isIndex ? 0.0004 : (inst.sector === 'IT' || inst.sector === 'Banking' ? 0.001 : 0.0018);

        for (let i = 0; i <= currentSlot; i++) {
            const slotStart = new Date(sessionStart.getTime() + i * oneMinMs);
            const isLast = i === currentSlot;

            const open = runningPrice;
            let close;

            if (isLast) {
                close = roundMoney(targetPrice);
            } else {
                // Sequential random walk with momentum and mean reversion to targetPrice
                const driftToTarget = ((targetPrice - runningPrice) / Math.max(1, currentSlot - i)) * 0.2;
                const noise = (this.seededRandom(seed++) * 2 - 1) * (refPrice * volFactor);
                
                momentum = 0.6 * momentum + 0.4 * noise;
                const stepChange = momentum + driftToTarget;
                close = roundMoney(open + stepChange);
                if (close <= 0) close = open;
            }

            const wickNoise = Math.abs(this.seededRandom(seed++) * (refPrice * volFactor * 0.5));
            const high = roundMoney(Math.max(open, close) + wickNoise);
            const low = roundMoney(Math.min(open, close) - wickNoise);
            const volume = isIndex ? 0 : Math.floor(100 + this.seededRandom(seed++) * 800);

            candles1m.push({
                symbol,
                interval: '1m',
                timestamp: slotStart.toISOString(),
                open,
                high,
                low,
                close,
                volume,
                source: 'SIMULATION'
            });

            runningPrice = close;
        }

        this.candles1mMap.set(symbol, candles1m);
        this.activeSlot1mMap.set(symbol, currentSlot);
        return candles1m;
    }

    /**
     * Update active 1-minute candle with new simulated price tick
     */
    updateTick(inst) {
        const symbol = (inst.symbol || '').toUpperCase().trim();
        let candles1m = this.candles1mMap.get(symbol);
        
        if (!candles1m || candles1m.length === 0) {
            candles1m = this.initSymbolSession(inst);
        }

        const now = new Date();
        const currentSlot = this.get1mSlotIndex(now);
        const sessionStart = this.getTodaySessionStart(now);
        const oneMinMs = 60 * 1000;

        let activeCandle1m = candles1m[candles1m.length - 1];
        const lastSlot = this.activeSlot1mMap.get(symbol) ?? (candles1m.length - 1);

        const newPrice = roundMoney(inst.lastPrice);
        const isIndex = inst.instrumentType === 'INDEX' || inst.type === 'INDEX';
        const tickVolume = isIndex ? 0 : Math.floor(10 + Math.random() * 40);

        if (currentSlot > lastSlot && currentSlot < 375) {
            // New 1-minute boundary crossed -> Start new 1m candle with open = prev1m.close
            const newSlotStart = new Date(sessionStart.getTime() + currentSlot * oneMinMs);
            const prevClose = activeCandle1m.close;

            activeCandle1m = {
                symbol,
                interval: '1m',
                timestamp: newSlotStart.toISOString(),
                open: prevClose,
                high: Math.max(prevClose, newPrice),
                low: Math.min(prevClose, newPrice),
                close: newPrice,
                volume: tickVolume,
                source: 'SIMULATION'
            };

            candles1m.push(activeCandle1m);
            this.activeSlot1mMap.set(symbol, currentSlot);
        } else {
            // Update current forming 1m candle
            activeCandle1m.high = roundMoney(Math.max(activeCandle1m.high, newPrice));
            activeCandle1m.low = roundMoney(Math.min(activeCandle1m.low, newPrice));
            activeCandle1m.close = newPrice;
            if (!isIndex) {
                activeCandle1m.volume += tickVolume;
            }
        }

        return activeCandle1m;
    }

    /**
     * Dynamically aggregate 1m candle stream into 15m candles
     * Rules:
     * Open = first 1m candle open
     * High = maximum 1m candle high
     * Low = minimum 1m candle low
     * Close = last 1m candle close
     * Volume = sum of 1m candle volumes
     */
    aggregate1mTo15m(candles1m) {
        if (!candles1m || candles1m.length === 0) return [];

        const blocks = new Map();
        for (const candle of candles1m) {
            const d = new Date(candle.timestamp);
            const sessionStart = this.getTodaySessionStart(d);
            const diffMs = d.getTime() - sessionStart.getTime();
            const fifteenMinsMs = 15 * 60 * 1000;
            const slot15m = Math.max(0, Math.floor(diffMs / fifteenMinsMs));

            if (!blocks.has(slot15m)) {
                blocks.set(slot15m, []);
            }
            blocks.get(slot15m).push(candle);
        }

        const candles15m = [];
        for (const [slot, group] of blocks.entries()) {
            if (group.length === 0) continue;

            const first1m = group[0];
            const last1m = group[group.length - 1];

            const high = roundMoney(Math.max(...group.map(c => c.high)));
            const low = roundMoney(Math.min(...group.map(c => c.low)));
            const totalVolume = group.reduce((sum, c) => sum + (c.volume || 0), 0);

            candles15m.push({
                symbol: first1m.symbol,
                interval: '15m',
                timestamp: first1m.timestamp,
                open: first1m.open,
                high,
                low,
                close: last1m.close,
                volume: totalVolume,
                source: 'SIMULATION'
            });
        }

        return candles15m;
    }

    /**
     * Retrieve 1D simulated candles for an instrument
     * @param {Object|string} inst - Instrument object or symbol
     * @param {string} interval - '1m' or '15m'
     */
    getCandles(inst, interval = '15m') {
        const symbol = typeof inst === 'string' ? inst.toUpperCase().trim() : (inst.symbol || '').toUpperCase().trim();
        let candles1m = this.candles1mMap.get(symbol);

        if (!candles1m || candles1m.length === 0) {
            const instObj = typeof inst === 'object' ? inst : { symbol, lastPrice: 100, referencePrice: 100 };
            candles1m = this.initSymbolSession(instObj);
        }

        const normInterval = (interval || '15m').toLowerCase().trim();

        if (normInterval === '1m') {
            return candles1m;
        }

        // Default or 15m -> Aggregate strictly from 1m candles
        return this.aggregate1mTo15m(candles1m);
    }

    /**
     * Clear memory on server restart
     */
    reset() {
        this.candles1mMap.clear();
        this.activeSlot1mMap.clear();
    }
}

// Singleton instance across backend
const intradayCandleService = new IntradayCandleService();
module.exports = intradayCandleService;
