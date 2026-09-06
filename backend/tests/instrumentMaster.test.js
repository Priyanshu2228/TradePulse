const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { InstrumentModel } = require('../models/Instrument');
const { seedInstruments, SEED_UNIVERSE } = require('../services/instrumentSeedService');
const { marketDataManagerInstance } = require('../services/marketData/MarketDataManager');
const { searchInstruments, getWatchlist } = require('../controllers/tradingController');
const { UserModel } = require('../models/User');
const { WatchlistModel } = require('../models/Watchlist');

jest.setTimeout(30000);

let mongoServer;
let userId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const user = await UserModel.create({
        name: 'Master Tester',
        email: 'master@test.com',
        passwordHash: 'hash'
    });
    userId = user._id.toString();
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('Phase 2: Indian Equity Instrument Master', () => {
    it('should seed 35+ Indian equities and canonical indices idempotently', async () => {
        const firstRunCount = await seedInstruments();
        expect(firstRunCount).toBe(SEED_UNIVERSE.length);

        const countInDbFirst = await InstrumentModel.countDocuments();
        expect(countInDbFirst).toBe(SEED_UNIVERSE.length);

        // Run seed a second time - should be completely idempotent
        await seedInstruments();
        const countInDbSecond = await InstrumentModel.countDocuments();
        expect(countInDbSecond).toBe(SEED_UNIVERSE.length);
    });

    it('should correctly distinguish EQUITY vs INDEX instruments and exchanges', async () => {
        const nifty = await InstrumentModel.findOne({ symbol: 'NIFTY50' });
        expect(nifty).not.toBeNull();
        expect(nifty.instrumentType).toBe('INDEX');
        expect(nifty.exchange).toBe('NSE');

        const sensex = await InstrumentModel.findOne({ symbol: 'SENSEX' });
        expect(sensex).not.toBeNull();
        expect(sensex.instrumentType).toBe('INDEX');
        expect(sensex.exchange).toBe('BSE');

        const reliance = await InstrumentModel.findOne({ symbol: 'RELIANCE' });
        expect(reliance.instrumentType).toBe('EQUITY');
        expect(reliance.sector).toBe('Energy');
    });

    it('should safely handle special character symbols like M&M', async () => {
        const provider = marketDataManagerInstance.getProvider();
        await provider.init();

        const mm = provider.getInstrument('M&M');
        expect(mm).toBeDefined();
        expect(mm.symbol).toBe('M&M');

        // URL encoded lookup simulation
        const mmEncoded = provider.getInstrument('M%26M');
        expect(mmEncoded).toBeDefined();
        expect(mmEncoded.symbol).toBe('M&M');
    });

    it('should search instruments across symbol, companyName, sector, and aliases', async () => {
        const reqMockSymbol = { query: { q: 'INFY' } };
        const resMockSymbol = {
            status: function(code) { expect(code).toBe(200); return this; },
            json: function(data) {
                expect(data.some(inst => inst.symbol === 'INFY')).toBe(true);
            }
        };
        await searchInstruments(reqMockSymbol, resMockSymbol);

        const reqMockName = { query: { q: 'Infosys' } };
        const resMockName = {
            status: function(code) { expect(code).toBe(200); return this; },
            json: function(data) {
                expect(data.some(inst => inst.symbol === 'INFY')).toBe(true);
            }
        };
        await searchInstruments(reqMockName, resMockName);

        const reqMockSector = { query: { q: 'Banking' } };
        const resMockSector = {
            status: function(code) { expect(code).toBe(200); return this; },
            json: function(data) {
                expect(data.length).toBeGreaterThanOrEqual(5);
                expect(data.every(inst => inst.sector === 'Banking')).toBe(true);
            }
        };
        await searchInstruments(reqMockSector, resMockSector);

        const reqMockAlias = { query: { q: 'RIL' } };
        const resMockAlias = {
            status: function(code) { expect(code).toBe(200); return this; },
            json: function(data) {
                expect(data.some(inst => inst.symbol === 'RELIANCE')).toBe(true);
            }
        };
        await searchInstruments(reqMockAlias, resMockAlias);
    });

    it('should resolve user watchlist with expanded instrument universe snapshots', async () => {
        const reqMock = { user: { id: userId } };
        const resMock = {
            status: function(code) { expect(code).toBe(200); return this; },
            json: function(data) {
                expect(Array.isArray(data)).toBe(true);
                expect(data.length).toBe(10); // default watchlist length
                expect(data.some(inst => inst.symbol === 'RELIANCE')).toBe(true);
            }
        };
        await getWatchlist(reqMock, resMock);
    });
});
