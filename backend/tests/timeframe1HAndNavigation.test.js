const intradayCandleService = require('../services/marketData/IntradayCandleService');
const { getHistoricalOHLC } = require('../services/historicalDataService');
const { marketDataManagerInstance } = require('../services/marketData/MarketDataManager');

describe('1H Timeframe & Data Pipeline Tests', () => {

    beforeEach(() => {
        intradayCandleService.reset();
        process.env.MARKET_DATA_MODE = 'SIMULATION';
        process.env.MARKET_SIMULATION_FORCE_OPEN = 'true';
    });

    afterAll(() => {
        intradayCandleService.reset();
    });

    test('1H returns at most 60 1m candles from latest window', async () => {
        const inst = { symbol: 'INFY', lastPrice: 1500, referencePrice: 1500 };
        const all1m = intradayCandleService.getCandles(inst, '1m');

        const result1H = await getHistoricalOHLC('INFY', { range: '1H' });

        expect(result1H.range).toBe('1H');
        expect(result1H.interval).toBe('1m');
        expect(result1H.count).toBeLessThanOrEqual(60);
        expect(result1H.data.length).toBe(result1H.count);

        if (all1m.length >= 60) {
            expect(result1H.count).toBe(60);
        } else {
            expect(result1H.count).toBe(all1m.length);
        }
    });

    test('1H and 1D 1m share identical candle data for overlapping timestamps', async () => {
        const inst = { symbol: 'RELIANCE', lastPrice: 2400, referencePrice: 2400 };
        const all1m = intradayCandleService.getCandles(inst, '1m');
        const result1H = await getHistoricalOHLC('RELIANCE', { range: '1H' });

        const last601m = all1m.slice(-60);
        expect(result1H.data.length).toBe(last601m.length);

        for (let i = 0; i < result1H.data.length; i++) {
            expect(result1H.data[i].timestamp).toBe(last601m[i].timestamp);
            expect(result1H.data[i].open).toBe(last601m[i].open);
            expect(result1H.data[i].high).toBe(last601m[i].high);
            expect(result1H.data[i].low).toBe(last601m[i].low);
            expect(result1H.data[i].close).toBe(last601m[i].close);
        }
    });

    test('Latest 1H candle close === current simulated LTP', async () => {
        const provider = marketDataManagerInstance.getProvider();
        let inst = provider ? provider.getInstrument('INFY') : null;
        if (!inst) {
            inst = { symbol: 'INFY', lastPrice: 1550.00, referencePrice: 1550.00 };
        }

        inst.lastPrice = 1588.25;
        intradayCandleService.updateTick(inst);

        const result1H = await getHistoricalOHLC('INFY', { range: '1H' });
        const latestCandle = result1H.data[result1H.data.length - 1];

        expect(latestCandle.close).toBe(1588.25);
    });

    test('Market Closed: 1H candles stop updating when MARKET_SIMULATION_FORCE_OPEN=false outside market hours', async () => {
        process.env.MARKET_SIMULATION_FORCE_OPEN = 'false';

        const provider = marketDataManagerInstance.getProvider();
        if (provider) {
            const resultBefore = await getHistoricalOHLC('INFY', { range: '1H' });
            const beforeCount = resultBefore.count;
            const beforeLastClose = resultBefore.data[resultBefore.data.length - 1]?.close;

            provider.tick();

            const resultAfter = await getHistoricalOHLC('INFY', { range: '1H' });
            const afterCount = resultAfter.count;
            const afterLastClose = resultAfter.data[resultAfter.data.length - 1]?.close;

            expect(afterCount).toBe(beforeCount);
            expect(afterLastClose).toBe(beforeLastClose);
        }
    });
});
