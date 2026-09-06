const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { UserModel } = require('../models/User');
const { AccountModel } = require('../models/Account');
const { HoldingModel } = require('../models/Holding');
const { OrderModel } = require('../models/Order');
const { TradeModel } = require('../models/Trade');
const { LedgerModel } = require('../models/Ledger');
const { placeOrder } = require('../services/orderService');
const { simulatorInstance } = require('../services/marketSimulator');
const { executionEngineInstance } = require('../services/executionEngine');

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
    await TradeModel.deleteMany({});
    await LedgerModel.deleteMany({});

    user = await UserModel.create({ name: 'Trader One', email: 'trader1@test.com', passwordHash: 'hash' });
    await AccountModel.create({ userId: user._id, totalBalance: 100000.00, blockedBalance: 0.00 });

    simulatorInstance.updatePrice('INFY', 1500.00);
});

describe('LIMIT Order Lifecycle (BUY & SELL)', () => {
    test('LIMIT BUY triggers when market price drops to limit price', async () => {
        const order = await placeOrder(user._id, {
            instrumentSymbol: 'INFY',
            side: 'BUY',
            quantity: 10,
            orderType: 'LIMIT',
            price: 1450.00,
            idempotencyKey: 'limit-buy-1'
        });

        expect(order.status).toBe('OPEN');

        simulatorInstance.updatePrice('INFY', 1440.00);
        await executionEngineInstance.processOpenOrders(simulatorInstance.getAllPricesMap());

        const filledOrder = await OrderModel.findById(order._id);
        expect(filledOrder.status).toBe('FILLED');
        expect(filledOrder.executionPrice).toBe(1440.00);

        const account = await AccountModel.findOne({ userId: user._id });
        expect(account.totalBalance).toBe(85600.00);
        expect(account.blockedBalance).toBe(0.00);
        expect(account.availableBalance).toBe(85600.00);

        const holding = await HoldingModel.findOne({ userId: user._id, instrumentSymbol: 'INFY' });
        expect(holding).toBeDefined();
        expect(holding.quantity).toBe(10);
        expect(holding.avgPrice).toBe(1440.00);

        const trade = await TradeModel.findOne({ orderId: order._id });
        expect(trade).toBeDefined();
        expect(trade.value).toBe(14400.00);
    });

    test('LIMIT SELL triggers when market price rises to limit price', async () => {
        await HoldingModel.create({
            userId: user._id,
            instrumentSymbol: 'INFY',
            quantity: 10,
            blockedQuantity: 0,
            avgPrice: 1000.00
        });

        const order = await placeOrder(user._id, {
            instrumentSymbol: 'INFY',
            side: 'SELL',
            quantity: 5,
            orderType: 'LIMIT',
            price: 1600.00,
            idempotencyKey: 'limit-sell-1'
        });

        expect(order.status).toBe('OPEN');

        simulatorInstance.updatePrice('INFY', 1620.00);
        await executionEngineInstance.processOpenOrders(simulatorInstance.getAllPricesMap());

        const filledOrder = await OrderModel.findById(order._id);
        expect(filledOrder.status).toBe('FILLED');
        expect(filledOrder.executionPrice).toBe(1620.00);

        const account = await AccountModel.findOne({ userId: user._id });
        expect(account.totalBalance).toBe(108100.00);

        const holding = await HoldingModel.findOne({ userId: user._id, instrumentSymbol: 'INFY' });
        expect(holding.quantity).toBe(5);
        expect(holding.avgPrice).toBe(1000.00);
    });
});
