const {
    toPaisa,
    fromPaisa,
    roundMoney,
    calcValue,
    calcAvgCost,
    calcRealizedPnL,
    calcUnrealizedPnL
} = require('../utils/moneyUtils');

describe('Monetary Precision Utilities', () => {
    test('toPaisa and fromPaisa conversions', () => {
        expect(toPaisa(140.65)).toBe(14065);
        expect(fromPaisa(14065)).toBe(140.65);
        expect(toPaisa(0.1 + 0.2)).toBe(30);
    });

    test('roundMoney behavior', () => {
        expect(roundMoney(12.3456)).toBe(12.35);
        expect(roundMoney(12.3444)).toBe(12.34);
    });

    test('calcValue multiplying price and quantity', () => {
        expect(calcValue(10, 538.05)).toBe(5380.50);
        expect(calcValue(3, 1383.40)).toBe(4150.20);
    });

    test('calcAvgCost weighted average on multiple BUYs (Scenario B)', () => {
        // Scenario B from directive: Buy 10 at 100, then 10 at 200 => Avg 150
        const firstBuyAvg = calcAvgCost(0, 0, 10, 100);
        expect(firstBuyAvg).toBe(100.00);

        const secondBuyAvg = calcAvgCost(10, 100, 10, 200);
        expect(secondBuyAvg).toBe(150.00);
    });

    test('calcRealizedPnL on SELL (Scenario C)', () => {
        // Scenario C: Sell 5 at 250 with average cost 150 => Realized PnL = 5 * (250 - 150) = 500
        const pnl = calcRealizedPnL(5, 250, 150);
        expect(pnl).toBe(500.00);
    });

    test('calcUnrealizedPnL against current market price', () => {
        // 15 units left at average cost 150, current price 200 => Unrealized PnL = 15 * (200 - 150) = 750
        const unrealized = calcUnrealizedPnL(15, 200, 150);
        expect(unrealized).toBe(750.00);
    });
});
