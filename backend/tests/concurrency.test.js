const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { UserModel } = require('../models/User');
const { AccountModel } = require('../models/Account');
const { HoldingModel } = require('../models/Holding');
const { OrderModel } = require('../models/Order');
const { placeOrder } = require('../services/orderService');
const { simulatorInstance } = require('../services/marketSimulator');

let mongoServer;
let user;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await simulatorInstance.init();
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
    await UserModel.deleteMany({});
    await AccountModel.deleteMany({});
    await HoldingModel.deleteMany({});
    await OrderModel.deleteMany({});

    user = await UserModel.create({ name: 'Concurrent Trader', email: 'concurrent@test.com', passwordHash: 'hash' });
    await AccountModel.create({ userId: user._id, totalBalance: 100000.00, blockedBalance: 0.00 });
});

describe('Scenario A & Concurrency Safety', () => {
    test('User with ₹100,000 submitting 2 simultaneous BUY orders of ₹80,000 each: only 1 succeeds', async () => {
        const p1 = placeOrder(user._id, {
            instrumentSymbol: 'RELIANCE',
            side: 'BUY',
            quantity: 40,
            orderType: 'LIMIT',
            price: 2000.00,
            idempotencyKey: 'concurrent-buy-1'
        });

        const p2 = placeOrder(user._id, {
            instrumentSymbol: 'TCS',
            side: 'BUY',
            quantity: 40,
            orderType: 'LIMIT',
            price: 2000.00,
            idempotencyKey: 'concurrent-buy-2'
        });

        const results = await Promise.allSettled([p1, p2]);

        const fulfilled = results.filter(r => r.status === 'fulfilled');
        const rejected = results.filter(r => r.status === 'rejected');

        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);

        const account = await AccountModel.findOne({ userId: user._id });
        expect(account.blockedBalance).toBe(80000.00);
        expect(account.availableBalance).toBe(20000.00);
    });

    test('Concurrent SELL orders exceeding owned holding quantity: only valid total quantity is reserved', async () => {
        await HoldingModel.create({
            userId: user._id,
            instrumentSymbol: 'RELIANCE',
            quantity: 10,
            blockedQuantity: 0,
            avgPrice: 1000.00
        });

        const p1 = placeOrder(user._id, {
            instrumentSymbol: 'RELIANCE',
            side: 'SELL',
            quantity: 8,
            orderType: 'LIMIT',
            price: 2500.00,
            idempotencyKey: 'concurrent-sell-1'
        });

        const p2 = placeOrder(user._id, {
            instrumentSymbol: 'RELIANCE',
            side: 'SELL',
            quantity: 8,
            orderType: 'LIMIT',
            price: 2500.00,
            idempotencyKey: 'concurrent-sell-2'
        });

        const results = await Promise.allSettled([p1, p2]);

        const fulfilled = results.filter(r => r.status === 'fulfilled');
        const rejected = results.filter(r => r.status === 'rejected');

        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);

        const holding = await HoldingModel.findOne({ userId: user._id, instrumentSymbol: 'RELIANCE' });
        expect(holding.blockedQuantity).toBe(8);
        expect(holding.sellableQuantity).toBe(2);
    });
});
