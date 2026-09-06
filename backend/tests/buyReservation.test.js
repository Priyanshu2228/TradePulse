const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { UserModel } = require('../models/User');
const { AccountModel } = require('../models/Account');
const { OrderModel } = require('../models/Order');
const { LedgerModel } = require('../models/Ledger');
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
    await OrderModel.deleteMany({});
    await LedgerModel.deleteMany({});

    user = await UserModel.create({ name: 'Buy User', email: 'buy@test.com', passwordHash: 'hash' });
    await AccountModel.create({ userId: user._id, totalBalance: 100000.00, blockedBalance: 0.00 });

    simulatorInstance.updatePrice('RELIANCE', 2000.00);
});

describe('BUY Order Cash Reservation', () => {
    test('Placing a LIMIT BUY order reserves cash and updates blockedBalance and derived availableBalance', async () => {
        const order = await placeOrder(user._id, {
            instrumentSymbol: 'RELIANCE',
            side: 'BUY',
            quantity: 10, // 10 * 1500 = 15,000
            orderType: 'LIMIT',
            price: 1500.00,
            idempotencyKey: 'buy-key-1'
        });

        expect(order.status).toBe('OPEN');
        expect(order.reservedAmount).toBe(15000.00);

        const account = await AccountModel.findOne({ userId: user._id });
        expect(account.totalBalance).toBe(100000.00);
        expect(account.blockedBalance).toBe(15000.00);
        expect(account.availableBalance).toBe(85000.00);

        const ledger = await LedgerModel.findOne({ userId: user._id, type: 'BUY_RESERVATION' });
        expect(ledger).toBeDefined();
        expect(ledger.amount).toBe(15000.00);
        expect(ledger.balanceAfter).toBe(85000.00);
    });

    test('Rejects BUY order if required funds exceed spendable cash', async () => {
        await expect(placeOrder(user._id, {
            instrumentSymbol: 'RELIANCE',
            side: 'BUY',
            quantity: 100, // 100 * 2000 = 200,000 > 100,000
            orderType: 'LIMIT',
            price: 2000.00,
            idempotencyKey: 'buy-overdraft'
        })).rejects.toThrow(/Insufficient spendable funds/);

        const account = await AccountModel.findOne({ userId: user._id });
        expect(account.blockedBalance).toBe(0.00);
        expect(account.availableBalance).toBe(100000.00);
    });
});
