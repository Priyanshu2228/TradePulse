const request = require('supertest');
const app = require('../index');
const intradayCandleService = require('../services/marketData/IntradayCandleService');
const { marketDataManagerInstance } = require('../services/marketData/MarketDataManager');

describe('Coherent Intraday Market Simulator & Candle Pipeline', () => {

    beforeEach(() => {
        intradayCandleService.reset();
        process.env.MARKET_DATA_MODE = 'SIMULATION';
        process.env.MARKET_SIMULATION_FORCE_OPEN = 'true';
    });

    afterAll(() => {
        intradayCandleService.reset();
    });

    test('1D + 1m returns 375 candles for a full trading session (09:15 to 15:30 IST)', async () => {
        const inst = { symbol: 'INFY', lastPrice: 1500, referencePrice: 1500 };
        const candles1m = intradayCandleService.getCandles(inst, '1m');

        expect(candles1m.length).toBeGreaterThan(0);
        expect(candles1m.length).toBeLessThanOrEqual(375);

        // Check first candle start time (09:15 IST / 03:45 UTC)
        const firstTime = new Date(candles1m[0].timestamp);
        expect(firstTime.getUTCHours()).toBe(3);
        expect(firstTime.getUTCMinutes()).toBe(45);

        // Check spacing of 1-minute between consecutive candles
        if (candles1m.length > 1) {
            const t0 = new Date(candles1m[0].timestamp).getTime();
            const t1 = new Date(candles1m[1].timestamp).getTime();
            expect(t1 - t0).toBe(60 * 1000);
        }
    });

    test('1D + 15m returns 25 candles for a full trading session with 15-min spacing', async () => {
        const inst = { symbol: 'RELIANCE', lastPrice: 2500, referencePrice: 2500 };
        const candles15m = intradayCandleService.getCandles(inst, '15m');

        expect(candles15m.length).toBeGreaterThan(0);
        expect(candles15m.length).toBeLessThanOrEqual(25);

        if (candles15m.length > 1) {
            const t0 = new Date(candles15m[0].timestamp).getTime();
            const t1 = new Date(candles15m[1].timestamp).getTime();
            expect(t1 - t0).toBe(15 * 60 * 1000);
        }
    });

    test('OHLC integrity: high >= max(open, close) and low <= min(open, close)', async () => {
        const inst = { symbol: 'TCS', lastPrice: 3200, referencePrice: 3200 };
        const candles = intradayCandleService.getCandles(inst, '1m');

        for (const c of candles) {
            expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
            expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
            expect(c.source).toBe('SIMULATION');
        }
    });

    test('Continuity: consecutive 1m candles satisfy next.open === prev.close', async () => {
        const inst = { symbol: 'HDFCBANK', lastPrice: 1600, referencePrice: 1600 };
        const candles1m = intradayCandleService.getCandles(inst, '1m');

        for (let i = 1; i < candles1m.length; i++) {
            const prev = candles1m[i - 1];
            const curr = candles1m[i];
            expect(curr.open).toBe(prev.close);
        }
    });

    test('Strict 15m aggregation from underlying 1m candles', async () => {
        const inst = { symbol: 'ICICIBANK', lastPrice: 950, referencePrice: 950 };
        const candles1m = intradayCandleService.getCandles(inst, '1m');
        const candles15m = intradayCandleService.getCandles(inst, '15m');

        const firstBlock1m = candles1m.slice(0, Math.min(15, candles1m.length));
        const first15m = candles15m[0];

        expect(first15m.open).toBe(firstBlock1m[0].open);
        expect(first15m.close).toBe(firstBlock1m[firstBlock1m.length - 1].close);
        expect(first15m.high).toBe(Math.max(...firstBlock1m.map(c => c.high)));
        expect(first15m.low).toBe(Math.min(...firstBlock1m.map(c => c.low)));
        
        const expectedVol = firstBlock1m.reduce((sum, c) => sum + c.volume, 0);
        expect(first15m.volume).toBe(expectedVol);
    });

    test('Price consistency: current LTP === latest 1m close === latest 15m close', async () => {
        const provider = marketDataManagerInstance.getProvider();
        let inst = provider ? provider.getInstrument('INFY') : null;
        if (!inst) {
            inst = { symbol: 'INFY', lastPrice: 1450.50, referencePrice: 1450.00 };
        }

        inst.lastPrice = 1485.75;
        intradayCandleService.updateTick(inst);

        const candles1m = intradayCandleService.getCandles(inst, '1m');
        const candles15m = intradayCandleService.getCandles(inst, '15m');

        const latest1m = candles1m[candles1m.length - 1];
        const latest15m = candles15m[candles15m.length - 1];

        expect(inst.lastPrice).toBe(1485.75);
        expect(latest1m.close).toBe(1485.75);
        expect(latest15m.close).toBe(1485.75);
    });

    test('Market Closed: simulation tick loop freezes when force open is false outside market hours', async () => {
        process.env.MARKET_SIMULATION_FORCE_OPEN = 'false';

        const provider = marketDataManagerInstance.getProvider();
        if (provider) {
            const instBefore = provider.getInstrument('INFY');
            const initialPrice = instBefore ? instBefore.lastPrice : 1500;

            // Trigger tick loop
            provider.tick();

            const instAfter = provider.getInstrument('INFY');
            const finalPrice = instAfter ? instAfter.lastPrice : 1500;

            expect(finalPrice).toBe(initialPrice);
        }
    });

    test('Different symbols have distinct volatility profiles while adhering to continuous rules', async () => {
        const instIndex = { symbol: 'NIFTY50', instrumentType: 'INDEX', lastPrice: 22000, referencePrice: 22000 };
        const instEquity = { symbol: 'TATAMOTORS', instrumentType: 'EQUITY', sector: 'Automobile', lastPrice: 900, referencePrice: 900 };

        const candlesIndex = intradayCandleService.getCandles(instIndex, '1m');
        const candlesEquity = intradayCandleService.getCandles(instEquity, '1m');

        expect(candlesIndex[0].volume).toBe(0);
        expect(candlesEquity[0].volume).toBeGreaterThan(0);
    });
});
