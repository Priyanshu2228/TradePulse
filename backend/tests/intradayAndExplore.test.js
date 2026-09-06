const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../index');
const { UserModel } = require('../models/User');
const { WatchlistModel } = require('../models/Watchlist');
const { InstrumentModel } = require('../models/Instrument');
const { seedInstruments } = require('../services/instrumentSeedService');
const { marketDataManagerInstance } = require('../services/marketData/MarketDataManager');
const { generateToken } = require('../middleware/authMiddleware');
const intradayCandleService = require('../services/marketData/IntradayCandleService');

describe('Intraday 1D Simulation & Explore Favorites Integration Tests', () => {
    let tokenA, tokenB, userAId, userBId;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tradepulse_test');
        }

        await UserModel.deleteMany({});
        await WatchlistModel.deleteMany({});
        await seedInstruments();

        // Create User A
        const userA = await UserModel.create({
            name: 'User Intraday A',
            email: 'userA_intraday@test.com',
            passwordHash: 'hash',
            isVerified: true
        });
        tokenA = generateToken(userA);
        userAId = userA._id;

        // Create User B
        const userB = await UserModel.create({
            name: 'User Intraday B',
            email: 'userB_intraday@test.com',
            passwordHash: 'hash',
            isVerified: true
        });
        tokenB = generateToken(userB);
        userBId = userB._id;

        const provider = marketDataManagerInstance.getProvider();
        await provider.init();
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    describe('1D 15-Minute Intraday Candle Verification', () => {
        test('1. GET /api/historical/RELIANCE?range=1D returns 15-minute simulated candles', async () => {
            const res = await request(app)
                .get('/api/historical/RELIANCE?range=1D')
                .set('Authorization', `Bearer ${tokenA}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.symbol).toBe('RELIANCE');
            expect(res.body.range).toBe('1D');
            expect(res.body.interval).toBe('15m');
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);

            const candles = res.body.data;
            const firstCandle = candles[0];

            // Verify candle structure
            expect(firstCandle).toHaveProperty('timestamp');
            expect(firstCandle).toHaveProperty('open');
            expect(firstCandle).toHaveProperty('high');
            expect(firstCandle).toHaveProperty('low');
            expect(firstCandle).toHaveProperty('close');
            expect(firstCandle).toHaveProperty('volume');
            expect(firstCandle.source).toBe('SIMULATION');

            // Verify OHLC mathematical relationships
            candles.forEach(c => {
                expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
                expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
                expect(typeof c.volume).toBe('number');
                expect(c.volume).toBeGreaterThanOrEqual(0);
                expect(c.source).toBe('SIMULATION');
            });

            // Verify chronological order and ~15 minute interval spacing
            for (let i = 1; i < candles.length; i++) {
                const prevTime = new Date(candles[i - 1].timestamp).getTime();
                const currTime = new Date(candles[i].timestamp).getTime();
                expect(currTime).toBeGreaterThan(prevTime);
                expect(currTime - prevTime).toBe(15 * 60 * 1000);
            }
        });

        test('2. Latest candle close matches current simulated market price', async () => {
            const provider = marketDataManagerInstance.getProvider();
            const inst = provider.getInstrument('RELIANCE');

            const res = await request(app)
                .get('/api/historical/RELIANCE?range=1D')
                .set('Authorization', `Bearer ${tokenA}`);

            const candles = res.body.data;
            const latestCandle = candles[candles.length - 1];

            expect(latestCandle.close).toBe(inst.lastPrice);
        });

        test('3. Simulated price ticks update active 15m candle high/low/close', async () => {
            const provider = marketDataManagerInstance.getProvider();
            const inst = provider.getInstrument('INFY');

            // Initial candle query
            const resBefore = await request(app)
                .get('/api/historical/INFY?range=1D')
                .set('Authorization', `Bearer ${tokenA}`);
            const lastBefore = resBefore.body.data[resBefore.body.data.length - 1];

            // Trigger manual price update tick
            const newPrice = lastBefore.close + 15.50;
            provider.updatePrice('INFY', newPrice);

            // Query after tick
            const resAfter = await request(app)
                .get('/api/historical/INFY?range=1D')
                .set('Authorization', `Bearer ${tokenA}`);
            const lastAfter = resAfter.body.data[resAfter.body.data.length - 1];

            expect(lastAfter.close).toBe(newPrice);
            expect(lastAfter.high).toBeGreaterThanOrEqual(newPrice);
        });

        test('4. MARKET_SIMULATION_FORCE_OPEN=false outside market hours freezes price & candle updates', async () => {
            const originalForce = process.env.MARKET_SIMULATION_FORCE_OPEN;
            process.env.MARKET_SIMULATION_FORCE_OPEN = 'false';

            const provider = marketDataManagerInstance.getProvider();
            const instBefore = { ...provider.getInstrument('TCS') };

            // Call tick directly
            provider.tick();

            const instAfter = provider.getInstrument('TCS');
            
            // If real market is closed, tick() should not alter price
            const MarketCalendarService = require('../services/marketCalendarService');
            const realState = MarketCalendarService.getMarketState(new Date(), 'NSE');

            if (realState === 'CLOSED') {
                expect(instAfter.lastPrice).toBe(instBefore.lastPrice);
            }

            process.env.MARKET_SIMULATION_FORCE_OPEN = originalForce;
        });
    });

    describe('Explore Stocks Favorite Actions & User Isolation', () => {
        test('1. Add favorite from Explore persists in WatchlistModel and prevents duplicates', async () => {
            // Add TCS for User A
            const addRes = await request(app)
                .post('/api/watchlist/add')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ symbol: 'TCS' });

            expect(addRes.statusCode).toBe(200);
            expect(addRes.body.symbols).toContain('TCS');

            // Duplicate Add attempt
            const dupRes = await request(app)
                .post('/api/watchlist/add')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ symbol: 'TCS' });

            expect(dupRes.statusCode).toBe(200);
            // Count of TCS in list should be exactly 1
            const count = dupRes.body.symbols.filter(s => s === 'TCS').length;
            expect(count).toBe(1);
        });

        test('2. Remove favorite from Explore updates WatchlistModel', async () => {
            const removeRes = await request(app)
                .post('/api/watchlist/remove')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ symbol: 'TCS' });

            expect(removeRes.statusCode).toBe(200);
            expect(removeRes.body.symbols).not.toContain('TCS');
        });

        test('3. User A favorites do not affect User B favorites (User Isolation)', async () => {
            // Add AXISBANK for User A
            await request(app)
                .post('/api/watchlist/add')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ symbol: 'AXISBANK' });

            // Fetch User B watchlist
            await request(app)
                .get('/api/watchlist')
                .set('Authorization', `Bearer ${tokenB}`);

            const watchB = await WatchlistModel.findOne({ userId: userBId });
            const watchA = await WatchlistModel.findOne({ userId: userAId });

            expect(watchA.symbols).toContain('AXISBANK');
            expect(watchB.symbols).not.toContain('AXISBANK');
        });
    });
});
