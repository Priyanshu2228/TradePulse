const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { OHLCModel } = require('../models/OHLC');
const { seedInstruments } = require('../services/instrumentSeedService');
const {
    importHistoricalDataset,
    getProviderSymbol,
    fetchYahooFinanceChart
} = require('../services/historicalDataSeeder');
const {
    getHistoricalOHLC,
    aggregateCandles,
    clearHistoricalCache,
    resolveDateBounds,
    getProviderSymbolMapping
} = require('../services/historicalDataService');
const MarketCalendarService = require('../services/marketCalendarService');
const HistoricalMarketDataProvider = require('../services/marketData/HistoricalMarketDataProvider');

jest.setTimeout(45000);

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await seedInstruments();
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('Phase 3: Real Historical Market Data & OHLC Foundation', () => {
    it('should query real Yahoo Finance API and import OHLC dataset with source YAHOO_FINANCE', async () => {
        // Query 1y range real Yahoo Finance dataset
        const auditReports = await importHistoricalDataset('1y');
        expect(Array.isArray(auditReports)).toBe(true);
        expect(auditReports.length).toBeGreaterThanOrEqual(40);

        const infyAudit = auditReports.find(a => a.symbol === 'INFY');
        expect(infyAudit).toBeDefined();
        expect(infyAudit.providerSymbol).toBe('INFY.NS');
        expect(infyAudit.failed).toBe(false);
        expect(infyAudit.importedCount).toBeGreaterThan(200);

        // Verify stored documents contain source: YAHOO_FINANCE
        const storedInfy = await OHLCModel.findOne({ symbol: 'INFY' });
        expect(storedInfy).toBeDefined();
        expect(storedInfy.source).toBe('YAHOO_FINANCE');
    });

    it('should verify provider symbol mappings for equities and canonical indices', () => {
        expect(getProviderSymbol('INFY')).toBe('INFY.NS');
        expect(getProviderSymbol('RELIANCE')).toBe('RELIANCE.NS');
        expect(getProviderSymbol('M&M')).toBe('M&M.NS');
        expect(getProviderSymbol('NIFTY50')).toBe('^NSEI');
        expect(getProviderSymbol('BANKNIFTY')).toBe('^NSEBANK');
        expect(getProviderSymbol('SENSEX')).toBe('^BSESN');
        expect(getProviderSymbol('TATAMOTORS')).toBe('TMPV.NS');
        expect(getProviderSymbol('LTIM')).toBe('LTTS.NS');
    });

    it('should enforce compound unique index { symbol, interval, timestamp } to prevent duplicates', async () => {
        const timestamp = new Date('2024-01-15T00:00:00.000+05:30');
        
        await OHLCModel.create({
            symbol: 'UNIQUE_TEST',
            exchange: 'NSE',
            interval: '1D',
            timestamp,
            open: 100, high: 105, low: 95, close: 102, volume: 1000,
            source: 'YAHOO_FINANCE'
        });

        // Attempt inserting duplicate candle
        await expect(OHLCModel.create({
            symbol: 'UNIQUE_TEST',
            exchange: 'NSE',
            interval: '1D',
            timestamp,
            open: 101, high: 106, low: 96, close: 103, volume: 2000,
            source: 'YAHOO_FINANCE'
        })).rejects.toThrow();
    });

    it('should verify OHLC mathematical integrity across stored Yahoo Finance dataset', async () => {
        const sampleCandles = await OHLCModel.find({ symbol: 'INFY' }).limit(50);
        expect(sampleCandles.length).toBeGreaterThan(0);

        sampleCandles.forEach(c => {
            expect(c.source).toBe('YAHOO_FINANCE');
            expect(c.high).toBeGreaterThanOrEqual(c.open);
            expect(c.high).toBeGreaterThanOrEqual(c.close);
            expect(c.low).toBeLessThanOrEqual(c.open);
            expect(c.low).toBeLessThanOrEqual(c.close);
            expect(c.high).toBeGreaterThanOrEqual(c.low);
            expect(c.volume).toBeGreaterThanOrEqual(0);
        });

        // Verify chronological timestamp ordering
        for (let i = 0; i < sampleCandles.length - 1; i++) {
            expect(new Date(sampleCandles[i].timestamp).getTime()).toBeLessThan(new Date(sampleCandles[i + 1].timestamp).getTime());
        }
    });

    it('should calculate timeframe aggregations (1W and 1M) with reduce volume summation', () => {
        const mockDaily = [
            { symbol: 'INFY', timestamp: new Date('2024-01-01'), open: 100, high: 110, low: 98, close: 105, volume: 1000 },
            { symbol: 'INFY', timestamp: new Date('2024-01-02'), open: 106, high: 115, low: 102, close: 112, volume: 1500 },
            { symbol: 'INFY', timestamp: new Date('2024-01-03'), open: 111, high: 112, low: 95, close: 98, volume: 2000 }
        ];

        const aggregated = aggregateCandles(mockDaily, '1M');
        expect(aggregated.length).toBe(1);

        const monthly = aggregated[0];
        expect(monthly.open).toBe(100);       // first candle open
        expect(monthly.high).toBe(115);       // max high
        expect(monthly.low).toBe(95);         // min low
        expect(monthly.close).toBe(98);        // last candle close
        expect(monthly.volume).toBe(4500);     // sum volume via reduce
    });

    it('should respect date precedence: explicit from/to parameters override range', async () => {
        const allInfy = await OHLCModel.find({ symbol: 'INFY' }).sort({ timestamp: 1 });
        expect(allInfy.length).toBeGreaterThan(10);

        const fromDateStr = MarketCalendarService.formatISTDateString(allInfy[0].timestamp);
        const toDateStr = MarketCalendarService.formatISTDateString(allInfy[10].timestamp);

        const result = await getHistoricalOHLC('INFY', {
            from: fromDateStr,
            to: toDateStr
        });

        expect(result.symbol).toBe('INFY');
        expect(result.data.length).toBeGreaterThan(0);
        
        const firstDateStr = MarketCalendarService.formatISTDateString(result.data[0].timestamp);
        const lastDateStr = MarketCalendarService.formatISTDateString(result.data[result.data.length - 1].timestamp);

        expect(firstDateStr >= fromDateStr).toBe(true);
        expect(lastDateStr <= toDateStr).toBe(true);
    });

    it('should support MAX range resolving to full historical record span', async () => {
        const result = await getHistoricalOHLC('INFY', { range: 'MAX' });
        expect(result.range).toBe('MAX');
        expect(result.count).toBeGreaterThan(100);
    });

    it('should reject from > to with 400 Bad Request error', async () => {
        await expect(getHistoricalOHLC('INFY', {
            from: '2026-12-31',
            to: '2024-01-01'
        })).rejects.toThrow(/from.*date must be earlier/i);
    });

    it('should reject unsupported intraday intervals with UNSUPPORTED_INTERVAL error code', async () => {
        try {
            await getHistoricalOHLC('INFY', { interval: '5M' });
            fail('Should have thrown unsupported interval error');
        } catch (err) {
            expect(err.statusCode).toBe(400);
            expect(err.errorCode).toBe('UNSUPPORTED_INTERVAL');
            expect(err.message).toMatch(/Intraday interval "5M" is not available/);
        }
    });

    it('should reject queries exceeding 1000 candles with 400 Bad Request', async () => {
        await expect(getHistoricalOHLC('INFY', { limit: 1500 })).rejects.toThrow(/Limit cannot exceed 1000/);
    });

    it('should normalize dates using MarketCalendarService in IST timezone', () => {
        const dateInput = '2024-08-15'; // Independence Day
        const istMidnight = MarketCalendarService.normalizeToISTMidnight(dateInput);
        expect(istMidnight).toBeInstanceOf(Date);

        const formatted = MarketCalendarService.formatISTDateString(istMidnight);
        expect(formatted).toBe('2024-08-15');

        expect(MarketCalendarService.isHoliday('2024-08-15')).toBe(true);
        expect(MarketCalendarService.isWeekend('2024-08-17')).toBe(true); // Saturday
    });

    it('should handle failed Yahoo Finance HTTP API request without generating synthetic candles', async () => {
        // Attempt fetching invalid symbol from Yahoo Finance
        try {
            await fetchYahooFinanceChart('INVALID_TICKER_XYZ_12345');
            fail('Should have thrown HTTP error for invalid ticker');
        } catch (err) {
            expect(err.message).toMatch(/HTTP status|Malformed|Network/);
        }
    });

    it('should utilize in-memory query cache and support cache clearing', async () => {
        clearHistoricalCache();

        const res1 = await getHistoricalOHLC('TCS', { range: '1M' });
        const res2 = await getHistoricalOHLC('TCS', { range: '1M' });

        expect(res1.count).toBe(res2.count);
        expect(res1.data[0].close).toBe(res2.data[0].close);

        clearHistoricalCache();
    });

    it('should operate read-only HistoricalMarketDataProvider extending MarketDataProvider contract', async () => {
        const provider = new HistoricalMarketDataProvider();
        expect(provider.getMode()).toBe('HISTORICAL');
        await provider.init();

        const snapshot = provider.getInstrument('RELIANCE');
        expect(snapshot).toBeDefined();
        expect(snapshot.mode).toBe('HISTORICAL');

        expect(() => {
            provider.updatePrice('RELIANCE', 3000);
        }).toThrow(/Cannot modify real historical data prices/);
    });
});
