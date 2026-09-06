const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { UserModel } = require("../models/User");
const { AccountModel } = require("../models/Account");
const { HoldingModel } = require("../models/Holding");
const { OrderModel } = require("../models/Order");
const { TradeModel } = require("../models/Trade");
const { LedgerModel } = require("../models/Ledger");
const { PositionModel } = require("../models/Position");
const { placeOrder } = require("../services/orderService");
const { simulatorInstance } = require("../services/marketSimulator");
const { executionEngineInstance } = require("../services/executionEngine");
const { calcValue, calcUnrealizedPnL } = require("../utils/moneyUtils");

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
    await PositionModel.deleteMany({});
    user = await UserModel.create({ name: "Holdings Test", email: "holdings@test.com", passwordHash: "hash" });
    await AccountModel.create({ userId: user._id, totalBalance: 100000.00, blockedBalance: 0.00 });
});

describe("Holdings Weighted Average Cost Accounting", () => {

    test("BUY 3 at 1942.24 then BUY 2 at 1953.44: qty=5, investment=9733.60, avgCost=1946.72", async () => {
        simulatorInstance.updatePrice("INFY", 1942.24);
        const order1 = await placeOrder(user._id, {
            instrumentSymbol: "INFY", side: "BUY", quantity: 3,
            orderType: "MARKET", idempotencyKey: "infy-buy-3"
        });
        await executionEngineInstance.executeOrderFill(order1, 1942.24);

        const h1 = await HoldingModel.findOne({ userId: user._id, instrumentSymbol: "INFY" });
        expect(h1.quantity).toBe(3);
        expect(h1.avgPrice).toBe(1942.24);

        simulatorInstance.updatePrice("INFY", 1953.44);
        const order2 = await placeOrder(user._id, {
            instrumentSymbol: "INFY", side: "BUY", quantity: 2,
            orderType: "MARKET", idempotencyKey: "infy-buy-2"
        });
        await executionEngineInstance.executeOrderFill(order2, 1953.44);

        const holding = await HoldingModel.findOne({ userId: user._id, instrumentSymbol: "INFY" });
        expect(holding.quantity).toBe(5);
        expect(holding.avgPrice).toBe(1946.72);
        expect(calcValue(holding.quantity, holding.avgPrice)).toBe(9733.60);

        const trade1 = await TradeModel.findOne({ orderId: order1._id });
        expect(trade1.price).toBe(1942.24);
        expect(trade1.value).toBe(5826.72);

        const trade2 = await TradeModel.findOne({ orderId: order2._id });
        expect(trade2.price).toBe(1953.44);
        expect(trade2.value).toBe(3906.88);
    });

    test("Market price change does NOT alter avgCost or investment, but changes currValue and PnL", async () => {
        await HoldingModel.create({
            userId: user._id, instrumentSymbol: "INFY",
            quantity: 5, blockedQuantity: 0, avgPrice: 1946.72
        });
        const holding = await HoldingModel.findOne({ userId: user._id, instrumentSymbol: "INFY" });

        expect(holding.avgPrice).toBe(1946.72);
        expect(calcValue(holding.quantity, holding.avgPrice)).toBe(9733.60);

        expect(calcValue(holding.quantity, 2000.00)).toBe(10000.00);
        expect(calcUnrealizedPnL(holding.quantity, 2000.00, holding.avgPrice)).toBe(266.40);
        expect(holding.avgPrice).toBe(1946.72);
        expect(calcValue(holding.quantity, holding.avgPrice)).toBe(9733.60);

        expect(calcValue(holding.quantity, 1900.00)).toBe(9500.00);
        expect(calcUnrealizedPnL(holding.quantity, 1900.00, holding.avgPrice)).toBe(-233.60);
        expect(holding.avgPrice).toBe(1946.72);
        expect(calcValue(holding.quantity, holding.avgPrice)).toBe(9733.60);
    });

    test("calcValue precision: no float drift in 3x1942.24 plus 2x1953.44", () => {
        expect(calcValue(3, 1942.24)).toBe(5826.72);
        expect(calcValue(2, 1953.44)).toBe(3906.88);
        expect(calcValue(3, 1942.24) + calcValue(2, 1953.44)).toBe(9733.60);
    });
});
