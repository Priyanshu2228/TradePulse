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

    user = await UserModel.create({ name: 'Idempotency User', email: 'idem@test.com', passwordHash: 'hash' });
    await AccountModel.create({ userId: user._id, totalBalance: 100000.00, blockedBalance: 0.00 });
});

describe('Requirement 23 & Correction 10: Scoped Idempotency Key', () => {
    test('Repeated order submission with same idempotency key returns existing order without duplicate cash reservation or ledger entries', async () => {
        const payload = {
            instrumentSymbol: 'RELIANCE',
            side: 'BUY',
            quantity: 5,
            orderType: 'LIMIT',
            price: 2000.00,
            idempotencyKey: 'client-request-id-12345'
        };

        const order1 = await placeOrder(user._id, payload);
        const order2 = await placeOrder(user._id, payload);

        expect(order1._id.toString()).toBe(order2._id.toString());

        const count = await OrderModel.countDocuments({ userId: user._id });
        expect(count).toBe(1);

        const account = await AccountModel.findOne({ userId: user._id });
        expect(account.blockedBalance).toBe(10000.00);

        const ledgerCount = await LedgerModel.countDocuments({ userId: user._id, type: 'BUY_RESERVATION' });
        expect(ledgerCount).toBe(1);
    });
});
