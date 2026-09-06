const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../index');
const { simulatorInstance } = require('../services/marketSimulator');
const { InstrumentModel } = require('../models/Instrument');
const { UserModel } = require('../models/User');
const { WatchlistModel } = require('../models/Watchlist');
const { connectDB } = require('../config/db');
const { generateToken } = require('../middleware/authMiddleware');

describe('Market Simulator & Favorites System Integration Tests', () => {
    let userA, tokenA;
    let userB, tokenB;

    beforeAll(async () => {
        await connectDB();
        await simulatorInstance.init();

        await UserModel.deleteMany({ email: { $in: ['sim.usera@tradepulse.io', 'sim.userb@tradepulse.io'] } });
        await WatchlistModel.deleteMany({});

        userA = await UserModel.create({
            name: 'User A',
            email: 'sim.usera@tradepulse.io',
            passwordHash: 'hash',
            isVerified: true
        });
        tokenA = generateToken(userA);

        userB = await UserModel.create({
            name: 'User B',
            email: 'sim.userb@tradepulse.io',
            passwordHash: 'hash',
            isVerified: true
        });
        tokenB = generateToken(userB);
    });

    afterAll(async () => {
        await UserModel.deleteMany({ email: { $in: ['sim.usera@tradepulse.io', 'sim.userb@tradepulse.io'] } });
        await WatchlistModel.deleteMany({});
        await mongoose.connection.close();
    });

    describe('Market Simulator Real Price Movement Tests', () => {
        test('1. Full 46 instrument universe is loaded in DB and simulator', async () => {
            const dbCount = await InstrumentModel.countDocuments({});
            expect(dbCount).toBeGreaterThanOrEqual(46);

            const simInstruments = simulatorInstance.getAllInstruments();
            expect(simInstruments.length).toBeGreaterThanOrEqual(46);
        });

        test('2. Ticks generate real price changes across multiple instruments when session is OPEN', () => {
            process.env.MARKET_SIMULATION_FORCE_OPEN = 'true';

            const rel1 = simulatorInstance.getInstrument('RELIANCE').lastPrice;
            const infy1 = simulatorInstance.getInstrument('INFY').lastPrice;
            const tcs1 = simulatorInstance.getInstrument('TCS').lastPrice;

            // Trigger multiple simulation ticks
            for (let i = 0; i < 5; i++) {
                simulatorInstance.tick();
            }

            const rel2 = simulatorInstance.getInstrument('RELIANCE').lastPrice;
            const infy2 = simulatorInstance.getInstrument('INFY').lastPrice;
            const tcs2 = simulatorInstance.getInstrument('TCS').lastPrice;

            // Assert that prices actually changed between ticks
            expect(rel1 !== rel2 || infy1 !== infy2 || tcs1 !== tcs2).toBe(true);

            // Assert independent price movement (price deltas are not identical)
            const deltaRel = Math.abs(rel2 - rel1);
            const deltaInfy = Math.abs(infy2 - infy1);
            expect(deltaRel !== deltaInfy).toBe(true);
        });

        test('3. Non-negative price floor and reference price bounds are respected', () => {
            const all = simulatorInstance.getAllInstruments();
            all.forEach(inst => {
                expect(inst.lastPrice).toBeGreaterThan(0);
                const ref = inst.referencePrice || inst.previousClose;
                if (ref > 0) {
                    expect(inst.lastPrice).toBeLessThanOrEqual(ref * 1.35);
                    expect(inst.lastPrice).toBeGreaterThanOrEqual(ref * 0.65);
                }
            });
        });

        test('4. Market closed state prevents price ticks when force open is false', () => {
            process.env.MARKET_SIMULATION_FORCE_OPEN = 'false';

            const MarketCalendarService = require('../services/marketCalendarService');
            jest.spyOn(MarketCalendarService, 'getMarketState').mockReturnValue('CLOSED');

            const initialRel = simulatorInstance.getInstrument('RELIANCE').lastPrice;
            simulatorInstance.tick();
            const afterRel = simulatorInstance.getInstrument('RELIANCE').lastPrice;

            expect(initialRel).toBe(afterRel);

            jest.restoreAllMocks();
            process.env.MARKET_SIMULATION_FORCE_OPEN = 'true';
        });
    });

    describe('Favorites & Reordering API Tests', () => {
        test('1. Get default watchlist for new user', async () => {
            const res = await request(app)
                .get('/api/watchlist')
                .set('Authorization', `Bearer ${tokenA}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
        });

        test('2. Add and Remove stock from Favorites', async () => {
            // Add TATAMOTORS
            const addRes = await request(app)
                .post('/api/watchlist/add')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ symbol: 'TATAMOTORS' });

            expect(addRes.statusCode).toBe(200);
            expect(addRes.body.symbols).toContain('TATAMOTORS');

            // Remove TATAMOTORS
            const removeRes = await request(app)
                .post('/api/watchlist/remove')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ symbol: 'TATAMOTORS' });

            expect(removeRes.statusCode).toBe(200);
            expect(removeRes.body.symbols).not.toContain('TATAMOTORS');
        });

        test('3. Reorder Favorites persists custom order for user', async () => {
            const newOrder = ['TCS', 'INFY', 'RELIANCE', 'WIPRO'];
            const reorderRes = await request(app)
                .post('/api/watchlist/reorder')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ symbols: newOrder });

            expect(reorderRes.statusCode).toBe(200);
            expect(reorderRes.body.symbols).toEqual(newOrder);

            // Fetch watchlist and verify exact stored order
            const fetchRes = await request(app)
                .get('/api/watchlist')
                .set('Authorization', `Bearer ${tokenA}`);

            const fetchedSymbols = fetchRes.body.map(item => item.symbol);
            expect(fetchedSymbols.slice(0, 4)).toEqual(newOrder);
        });

        test('4. User A and User B maintain completely separate Favorites & strict reorder validation', async () => {
            // Test strict reorder validation: submitting unfavorited symbol returns 400
            const badReorderRes = await request(app)
                .post('/api/watchlist/reorder')
                .set('Authorization', `Bearer ${tokenB}`)
                .send({ symbols: ['NONEXISTENT_SYMBOL'] });
            expect(badReorderRes.statusCode).toBe(400);

            // Add AXISBANK to User B watchlist first
            await request(app)
                .post('/api/watchlist/add')
                .set('Authorization', `Bearer ${tokenB}`)
                .send({ symbol: 'AXISBANK' });

            // Now reorder User B favorites
            await request(app)
                .post('/api/watchlist/reorder')
                .set('Authorization', `Bearer ${tokenB}`)
                .send({ symbols: ['HDFCBANK', 'ICICIBANK', 'AXISBANK'] });

            const resA = await request(app)
                .get('/api/watchlist')
                .set('Authorization', `Bearer ${tokenA}`);

            const resB = await request(app)
                .get('/api/watchlist')
                .set('Authorization', `Bearer ${tokenB}`);

            const symbolsA = resA.body.map(i => i.symbol);
            const symbolsB = resB.body.map(i => i.symbol);

            expect(symbolsA).not.toEqual(symbolsB);
            expect(symbolsB.slice(0, 3)).toEqual(['HDFCBANK', 'ICICIBANK', 'AXISBANK']);
        });
    });
});
