const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { UserModel } = require('../models/User');
const { AccountModel } = require('../models/Account');
const { HoldingModel } = require('../models/Holding');
const { OrderModel } = require('../models/Order');
const { placeOrder, cancelOrder } = require('../services/orderService');
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

    user = await UserModel.create({ name: 'Sell User', email: 'sell@test.com', passwordHash: 'hash' });
    await AccountModel.create({ userId: user._id, totalBalance: 100000.00, blockedBalance: 0.00 });

    await HoldingModel.create({
        userId: user._id,
        instrumentSymbol: 'RELIANCE',
        quantity: 10,
        blockedQuantity: 0,
        avgPrice: 1000.00
    });
});

describe('SELL Order Quantity Reservation', () => {
    test('Placing a SELL order reserves holding quantity and updates sellableQuantity', async () => {
        const order = await placeOrder(user._id, {
            instrumentSymbol: 'RELIANCE',
            side: 'SELL',
            quantity: 7,
            orderType: 'LIMIT',
            price: 2500.00,
            idempotencyKey: 'sell-key-1'
        });

        expect(order.status).toBe('OPEN');
        expect(order.reservedQuantity).toBe(7);

        const holding = await HoldingModel.findOne({ userId: user._id, instrumentSymbol: 'RELIANCE' });
        expect(holding.quantity).toBe(10);
        expect(holding.blockedQuantity).toBe(7);
        expect(holding.sellableQuantity).toBe(3);
    });

    test('Rejects SELL order if requested quantity exceeds sellable quantity', async () => {
        await placeOrder(user._id, {
            instrumentSymbol: 'RELIANCE',
            side: 'SELL',
            quantity: 7,
            orderType: 'LIMIT',
            price: 2500.00,
            idempotencyKey: 'sell-key-1'
        });

        await expect(placeOrder(user._id, {
            instrumentSymbol: 'RELIANCE',
            side: 'SELL',
            quantity: 5,
            orderType: 'LIMIT',
            price: 2500.00,
            idempotencyKey: 'sell-key-2'
        })).rejects.toThrow(/Insufficient sellable quantity/);
    });

    test('Cancelling SELL order releases quantity reservation', async () => {
        const order = await placeOrder(user._id, {
            instrumentSymbol: 'RELIANCE',
            side: 'SELL',
            quantity: 7,
            orderType: 'LIMIT',
            price: 2500.00,
            idempotencyKey: 'sell-key-1'
        });

        await cancelOrder(user._id, order._id);

        const holding = await HoldingModel.findOne({ userId: user._id, instrumentSymbol: 'RELIANCE' });
        expect(holding.blockedQuantity).toBe(0);
        expect(holding.sellableQuantity).toBe(10);
    });
});
