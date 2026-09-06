const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { TrueDataInstrumentMapper } = require('../services/marketData/adapters/TrueDataInstrumentMapper');
const { TrueDataMarketDataAdapter } = require('../services/marketData/adapters/TrueDataMarketDataAdapter');
const RealMarketDataProvider = require('../services/marketData/RealMarketDataProvider');

jest.setTimeout(30000);

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
});

describe('TrueData Market Data Integration', () => {

    describe('1. TrueDataInstrumentMapper', () => {
        test('should correctly map canonical symbols to TrueData vendor symbols', () => {
            expect(TrueDataInstrumentMapper.toTrueDataSymbol('RELIANCE')).toBe('RELIANCE-EQ');
            expect(TrueDataInstrumentMapper.toTrueDataSymbol('INFY')).toBe('INFY-EQ');
            expect(TrueDataInstrumentMapper.toTrueDataSymbol('NIFTY50')).toBe('NIFTY 50');
            expect(TrueDataInstrumentMapper.toTrueDataSymbol('BANKNIFTY')).toBe('NIFTY BANK');
            expect(TrueDataInstrumentMapper.toTrueDataSymbol('SENSEX')).toBe('SENSEX');
        });

        test('should correctly map TrueData vendor symbols back to canonical symbols', () => {
            expect(TrueDataInstrumentMapper.toCanonicalSymbol('RELIANCE-EQ')).toBe('RELIANCE');
            expect(TrueDataInstrumentMapper.toCanonicalSymbol('INFY-EQ')).toBe('INFY');
            expect(TrueDataInstrumentMapper.toCanonicalSymbol('NIFTY 50')).toBe('NIFTY50');
            expect(TrueDataInstrumentMapper.toCanonicalSymbol('NIFTY BANK')).toBe('BANKNIFTY');
            expect(TrueDataInstrumentMapper.toCanonicalSymbol('SENSEX')).toBe('SENSEX');
        });
    });

    describe('2. TrueDataMarketDataAdapter Initialization & Credentials Guard', () => {
        test('should throw an explicit error if credentials are missing on init', async () => {
            const adapter = new TrueDataMarketDataAdapter({ username: '', password: '' });
            await expect(adapter.init()).rejects.toThrow('Credentials missing');
        });

        test('should normalize raw TrueData ticks into TradePulse standard schema', () => {
            const adapter = new TrueDataMarketDataAdapter({ username: 'demo', password: 'password' });
            const rawMessage = {
                symbol: 'RELIANCE-EQ',
                exchange: 'NSE',
                ltp: 2860.50,
                open: 2840.00,
                high: 2870.00,
                low: 2835.00,
                prev_close: 2845.00,
                volume: 125000,
                change: 15.50,
                timestamp: 1725450000000
            };

            const tick = adapter.normalizeTick(rawMessage);
            expect(tick).toBeDefined();
            expect(tick.symbol).toBe('RELIANCE');
            expect(tick.exchange).toBe('NSE');
            expect(tick.ltp).toBe(2860.50);
            expect(tick.previousClose).toBe(2845.00);
            expect(tick.change).toBe(15.50);
            expect(tick.changePercent).toBeCloseTo(0.544, 2);
            expect(tick.source).toBe('TRUEDATA');
            expect(tick.feedType).toBe('AUTHORIZED_VENDOR_FEED');
        });
    });

    describe('3. RealMarketDataProvider with TrueData Adapter', () => {
        test('should select TRUEDATA adapter when specified', () => {
            const provider = new RealMarketDataProvider({
                provider: 'TRUEDATA',
                username: 'demo_user',
                password: 'demo_password'
            });

            expect(provider.providerName).toBe('TRUEDATA');
            expect(provider.adapter).toBeInstanceOf(TrueDataMarketDataAdapter);
        });

        test('should strictly throw authentication error on startup if credentials invalid', async () => {
            const provider = new RealMarketDataProvider({
                provider: 'TRUEDATA',
                username: '',
                password: ''
            });

            await expect(provider.init()).rejects.toThrow();
            expect(provider.connectionState).toBe('AUTHENTICATION_FAILED');
        });
    });
});
