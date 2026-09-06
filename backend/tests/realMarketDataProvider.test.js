const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const RealMarketDataProvider = require('../services/marketData/RealMarketDataProvider');
const { MarketDataManager } = require('../services/marketData/MarketDataManager');
const { ProviderInstrumentMapper } = require('../services/marketData/providerInstrumentMapper');
const { NSEPublicQuoteAdapter, SYMBOL_TO_PUBLIC_KEY } = require('../services/marketData/adapters/NSEPublicQuoteAdapter');
const MarketCalendarService = require('../services/marketCalendarService');
const { UserModel } = require('../models/User');
const { AccountModel } = require('../models/Account');
const { TradeModel } = require('../models/Trade');
const { placeOrder } = require('../services/orderService');

jest.setTimeout(30000);

let mongoServer;
let userId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const { seedInstruments } = require('../services/instrumentSeedService');
    await seedInstruments();

    const user = await UserModel.create({
        name: 'Live Provider Test User',
        email: 'liveprovider@example.com',
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

describe('Phase 5: Real Market Data Integration (Account-Free Broker-Independent Architecture)', () => {

    // 1. Account-Free Provider Key Mapping
    it('1. should resolve public quote keys for canonical symbols without requiring a Demat account', () => {
        expect(SYMBOL_TO_PUBLIC_KEY['RELIANCE']).toBe('RELIANCE.NS');
        expect(SYMBOL_TO_PUBLIC_KEY['INFY']).toBe('INFY.NS');
        expect(SYMBOL_TO_PUBLIC_KEY['NIFTY50']).toBe('^NSEI');
        expect(SYMBOL_TO_PUBLIC_KEY['SENSEX']).toBe('^BSESN');
    });

    // 2. Public Quote Fetch & Snapshot Normalization
    it('2. should fetch and normalize live market quotes via NSEPublicQuoteAdapter', async () => {
        const adapter = new NSEPublicQuoteAdapter();
        
        // Mock public HTTP quote response
        jest.spyOn(adapter, 'fetchQuotes').mockResolvedValueOnce([
            {
                symbol: 'RELIANCE',
                ltp: 2850.40, open: 2840.00, high: 2860.00, low: 2835.00, close: 2835.20, previousClose: 2835.20,
                change: 15.20, changePercent: 0.54, volume: 4500000, marketState: 'REGULAR', timestamp: Date.now()
            }
        ]);

        const quotes = await adapter.fetchQuotes(['RELIANCE']);
        expect(quotes).toHaveLength(1);
        expect(quotes[0].symbol).toBe('RELIANCE');
        expect(quotes[0].ltp).toBe(2850.40);
        expect(quotes[0].changePercent).toBe(0.54);
    });

    // 3. RealMarketDataProvider Initialization & Application of Quotes
    it('3. should initialize RealMarketDataProvider and apply quotes to price map', async () => {
        const provider = new RealMarketDataProvider();
        
        jest.spyOn(provider.adapter, 'fetchQuotes').mockResolvedValue([
            { symbol: 'RELIANCE', ltp: 2855.00, previousClose: 2835.20, close: 2835.20, open: 2840.00, high: 2860.00, low: 2835.00, change: 19.80, changePercent: 0.70, volume: 500000 }
        ]);

        await provider.init();
        expect(provider.connectionState).toBe('CONNECTED');

        const inst = provider.getInstrument('RELIANCE');
        expect(inst).toBeDefined();
        expect(inst.lastPrice).toBe(2855.00);
        expect(inst.source).toBe('LIVE');
        expect(inst.mode).toBe('LIVE');
    });

    // 4. Failure Policy: Explicit Exception on Startup Network Outage
    it('4. should fail clearly on startup initialization error without falling back to SIMULATION', async () => {
        const provider = new RealMarketDataProvider();
        jest.spyOn(provider.adapter, 'fetchQuotes').mockRejectedValueOnce(new Error('Network Unreachable'));

        await expect(provider.init()).rejects.toThrow(/Network Unreachable/);
        expect(provider.connectionState).toBe('AUTHENTICATION_FAILED');
    });

    // 5. Market Close Freeze Price Behavior
    it('5. should freeze prices and stop polling when market state is CLOSED', async () => {
        const provider = new RealMarketDataProvider();
        provider.prices.set('RELIANCE', provider._formatSnapshot({ symbol: 'RELIANCE', lastPrice: 2850.40 }));

        const spyFetch = jest.spyOn(provider.adapter, 'fetchQuotes');
        jest.spyOn(MarketCalendarService, 'getMarketState').mockReturnValue('CLOSED');

        await provider._pollLiveQuotes();

        // No network fetch should occur when market is CLOSED
        expect(spyFetch).not.toHaveBeenCalled();
        expect(provider.getInstrument('RELIANCE').lastPrice).toBe(2850.40); // Price remains frozen!

        MarketCalendarService.getMarketState.mockRestore();
    });

    // 6. Market Open Polling & Update
    it('6. should poll and update live prices when market state is OPEN', async () => {
        const provider = new RealMarketDataProvider();
        provider.prices.set('RELIANCE', provider._formatSnapshot({ symbol: 'RELIANCE', lastPrice: 2850.40 }));

        jest.spyOn(MarketCalendarService, 'getMarketState').mockReturnValue('OPEN');
        jest.spyOn(provider.adapter, 'fetchQuotes').mockResolvedValueOnce([
            { symbol: 'RELIANCE', ltp: 2865.00, previousClose: 2835.20, close: 2835.20, open: 2840.00, high: 2870.00, low: 2835.00, change: 29.80, changePercent: 1.05, volume: 550000 }
        ]);

        await provider._pollLiveQuotes();

        expect(provider.getInstrument('RELIANCE').lastPrice).toBe(2865.00);

        MarketCalendarService.getMarketState.mockRestore();
    });

    // 7. Market Closed Order Rejection Rule
    it('7. should reject MARKET paper orders in LIVE mode when market is CLOSED', async () => {
        const { marketDataManagerInstance } = require('../services/marketData/MarketDataManager');
        const provider = marketDataManagerInstance.initProvider('live');
        
        provider.prices.set('RELIANCE', provider._formatSnapshot({ symbol: 'RELIANCE', lastPrice: 2850.40, exchange: 'NSE' }));
        provider.prices.get('RELIANCE').mode = 'LIVE';

        const { simulatorInstance } = require('../services/marketSimulator');
        simulatorInstance.prices.set('RELIANCE', provider.getInstrument('RELIANCE'));

        jest.spyOn(MarketCalendarService, 'getMarketState').mockReturnValue('CLOSED');

        await expect(placeOrder(userId, {
            instrumentSymbol: 'RELIANCE',
            side: 'BUY',
            quantity: 5,
            orderType: 'MARKET',
            idempotencyKey: 'market-closed-order-1'
        })).rejects.toThrow(/Market is currently closed/);

        MarketCalendarService.getMarketState.mockRestore();
    });

    // 8. Virtual Paper Execution on Live Market Price Update
    it('8. should execute virtual paper LIMIT order when live tick hits target price', async () => {
        const { marketDataManagerInstance } = require('../services/marketData/MarketDataManager');
        const provider = marketDataManagerInstance.initProvider('live');

        const { InstrumentModel } = require('../models/Instrument');
        const instruments = await InstrumentModel.find({});
        for (const inst of instruments) {
            provider.prices.set(inst.symbol, provider._formatSnapshot(inst));
        }

        const { simulatorInstance } = require('../services/marketSimulator');
        simulatorInstance.prices.set('INFY', provider.getInstrument('INFY'));

        // Place paper LIMIT BUY order for INFY at 1500.00
        const order = await placeOrder(userId, {
            instrumentSymbol: 'INFY',
            side: 'BUY',
            quantity: 10,
            orderType: 'LIMIT',
            price: 1500.00,
            idempotencyKey: 'live-limit-order-1'
        });
        expect(order.status).toBe('OPEN');

        const { executionEngineInstance } = require('../services/executionEngine');
        provider.setExecutionEngineCallback((pricesMap) => {
            executionEngineInstance.processOpenOrders(pricesMap);
        });

        // Trigger live quote price update dropping INFY ltp to 1490.00
        provider._applyQuotes([
            { symbol: 'INFY', ltp: 1490.00, previousClose: 1550.00, close: 1550.00, open: 1550.00, high: 1550.00, low: 1490.00, volume: 1000 }
        ]);

        await new Promise(resolve => setTimeout(resolve, 200));

        const trade = await TradeModel.findOne({ userId, orderId: order._id });
        expect(trade).not.toBeNull();
        expect(trade.price).toBe(1490.00);
        expect(trade.quantity).toBe(10);
    });

    // 9. Frontend Metadata Snapshot
    it('9. should format snapshot with complete live metadata', () => {
        const provider = new RealMarketDataProvider();
        provider.connectionState = 'CONNECTED';
        provider.marketStatus = 'OPEN';
        provider.isStale = false;

        const snapshot = provider._formatSnapshot({
            symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd.', lastPrice: 2850.40
        });

        expect(snapshot).toHaveProperty('symbol', 'RELIANCE');
        expect(snapshot).toHaveProperty('source', 'LIVE');
        expect(snapshot).toHaveProperty('mode', 'LIVE');
        expect(snapshot).toHaveProperty('connectionState', 'CONNECTED');
        expect(snapshot).toHaveProperty('marketStatus');
        expect(snapshot).toHaveProperty('isStale', false);
    });
});
