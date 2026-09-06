const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MarketDataManager, marketDataManagerInstance } = require('../services/marketData/MarketDataManager');
const { placeOrder } = require('../services/orderService');
const { AccountModel } = require('../models/Account');
const { TradeModel } = require('../models/Trade');
const { HoldingModel } = require('../models/Holding');
const { LedgerModel } = require('../models/Ledger');
const { UserModel } = require('../models/User');

jest.setTimeout(30000);

let mongoServer;
let userId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Initialize singleton provider with DB instruments
    await marketDataManagerInstance.getProvider().init();

    const user = await UserModel.create({
        name: 'Provider Test User',
        email: 'providertest@example.com',
        passwordHash: 'hashed_password_123'
    });
    userId = user._id.toString();

    await AccountModel.create({
        userId,
        totalBalance: 100000.00,
        blockedBalance: 0.00
    });
}, 30000);

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Phase 1: Market Data Provider Abstraction & Mode Selection', () => {
    it('should initialize SimulatedMarketDataProvider when MARKET_DATA_MODE=simulation', async () => {
        const manager = new MarketDataManager();
        const provider = manager.initProvider('simulation');

        expect(provider.getMode()).toBe('SIMULATION');
        await provider.init();

        const inst = provider.getInstrument('RELIANCE');
        expect(inst).toBeDefined();
        expect(inst.symbol).toBe('RELIANCE');
    });

    it('should throw an explicit error for unsupported market data modes', () => {
        const manager = new MarketDataManager();
        expect(() => {
            manager.initProvider('invalid_mode');
        }).toThrow(/Unsupported MARKET_DATA_MODE "invalid_mode"/);

        const liveProvider = manager.initProvider('live');
        expect(liveProvider.getMode()).toBe('LIVE');
    });

    it('should adhere to the standard Market Snapshot schema', async () => {
        const provider = marketDataManagerInstance.getProvider();

        const snapshot = provider.getInstrument('INFY');
        expect(snapshot).toHaveProperty('symbol', 'INFY');
        expect(snapshot).toHaveProperty('lastPrice');
        expect(snapshot).toHaveProperty('previousClose');
        expect(snapshot).toHaveProperty('open');
        expect(snapshot).toHaveProperty('high');
        expect(snapshot).toHaveProperty('low');
        expect(snapshot).toHaveProperty('volume');
        expect(snapshot).toHaveProperty('timestamp');
        expect(snapshot).toHaveProperty('source', 'SIMULATION');
        expect(snapshot).toHaveProperty('mode', 'SIMULATION');
    });

    it('should execute end-to-end order fill when price update occurs via event-driven provider', async () => {
        const provider = marketDataManagerInstance.getProvider();
        const symbol = 'INFY';

        // Set reference price
        provider.updatePrice(symbol, 1500.00);

        // Place LIMIT BUY order at 1450.00
        const order = await placeOrder(userId, {
            instrumentSymbol: symbol,
            side: 'BUY',
            quantity: 10,
            orderType: 'LIMIT',
            price: 1450.00,
            idempotencyKey: 'providertest-key-1'
        });

        expect(order.status).toBe('OPEN');

        // Account blocked balance should reflect reservation
        const accountBefore = await AccountModel.findOne({ userId });
        expect(accountBefore.blockedBalance).toBe(14500.00);

        // Trigger price drop to 1440.00 via provider updatePrice event
        provider.updatePrice(symbol, 1440.00);

        // Wait brief tick for execution engine processing
        await new Promise(resolve => setTimeout(resolve, 300));

        // Verify Trade creation
        const trade = await TradeModel.findOne({ userId, orderId: order._id });
        expect(trade).not.toBeNull();
        expect(trade.side).toBe('BUY');
        expect(trade.quantity).toBe(10);
        expect(trade.price).toBe(1440.00);

        // Verify Holding updated
        const holding = await HoldingModel.findOne({ userId, instrumentSymbol: symbol });
        expect(holding).not.toBeNull();
        expect(holding.quantity).toBe(10);
        expect(holding.avgPrice).toBe(1440.00);

        // Verify Ledger settlement record
        const ledger = await LedgerModel.findOne({ userId, referenceId: trade._id.toString() });
        expect(ledger).not.toBeNull();
        expect(ledger.type).toBe('BUY_SETTLEMENT');

        // Verify Account cash deducted correctly and blocked balance released
        const accountAfter = await AccountModel.findOne({ userId });
        expect(accountAfter.blockedBalance).toBe(0);
        expect(accountAfter.totalBalance).toBe(100000.00 - 14400.00);
    });
});
