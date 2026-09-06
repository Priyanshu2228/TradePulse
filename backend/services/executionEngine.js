const { OrderModel } = require('../models/Order');
const { AccountModel } = require('../models/Account');
const { HoldingModel } = require('../models/Holding');
const { PositionModel } = require('../models/Position');
const { TradeModel } = require('../models/Trade');
const { LedgerModel } = require('../models/Ledger');
const { calcValue, calcAvgCost, calcRealizedPnL, roundMoney } = require('../utils/moneyUtils');
const { withTransaction, checkReplicaSet } = require('../config/db');

class ExecutionEngine {
    constructor() {
        this.isProcessing = false;
        this.currentPromise = null;
    }

    async processOpenOrders(pricesMap) {
        if (this.isProcessing) {
            return this.currentPromise;
        }

        this.isProcessing = true;
        this.currentPromise = (async () => {
            try {
                const openOrders = await OrderModel.find({ status: 'OPEN' });
                for (const order of openOrders) {
                    const currentPrice = pricesMap[order.instrumentSymbol];
                    if (!currentPrice) continue;

                    let shouldExecute = false;
                    if (order.orderType === 'MARKET') {
                        shouldExecute = true;
                    } else if (order.orderType === 'LIMIT') {
                        if (order.side === 'BUY' && currentPrice <= order.price) {
                            shouldExecute = true;
                        } else if (order.side === 'SELL' && currentPrice >= order.price) {
                            shouldExecute = true;
                        }
                    }

                    if (shouldExecute) {
                        await this.executeOrderFill(order, currentPrice);
                    }
                }
            } catch (err) {
                console.error('[ExecutionEngine] Error processing open orders:', err);
            } finally {
                this.isProcessing = false;
                this.currentPromise = null;
            }
        })();

        return this.currentPromise;
    }

    async executeOrderFill(order, fillPrice) {
        const performExecution = async (session) => {
            const options = session ? { session } : {};

            // Reload order inside session to ensure it's still OPEN
            const freshOrder = await OrderModel.findOne({ _id: order._id, status: 'OPEN' }, null, options);
            if (!freshOrder) return;

            const userId = freshOrder.userId;
            const symbol = freshOrder.instrumentSymbol;
            const qty = freshOrder.quantity;
            const executionValue = calcValue(qty, fillPrice);

            const account = await AccountModel.findOne({ userId }, null, options);
            if (!account) return;

            if (freshOrder.side === 'BUY') {
                // Settle cash: release blocked reservation and deduct actual cash cost
                account.blockedBalance = Math.max(0, roundMoney(account.blockedBalance - freshOrder.reservedAmount));
                account.totalBalance = roundMoney(account.totalBalance - executionValue);
                await account.save(options);

                // Settle Holding: update quantity & weighted average cost
                let holding = await HoldingModel.findOne({ userId, instrumentSymbol: symbol }, null, options);
                if (!holding) {
                    await HoldingModel.create([{
                        userId,
                        instrumentSymbol: symbol,
                        quantity: qty,
                        blockedQuantity: 0,
                        avgPrice: fillPrice
                    }], options);
                } else {
                    const newQty = holding.quantity + qty;
                    const newAvgCost = calcAvgCost(holding.quantity, holding.avgPrice, qty, fillPrice);
                    holding.quantity = newQty;
                    holding.avgPrice = newAvgCost;
                    await holding.save(options);
                }

                // Settle Position (daily trading exposure summary)
                let position = await PositionModel.findOne({ userId, instrumentSymbol: symbol }, null, options);
                if (!position) {
                    await PositionModel.create([{
                        userId,
                        instrumentSymbol: symbol,
                        buyQuantity: qty,
                        sellQuantity: 0,
                        buyValue: executionValue,
                        sellValue: 0,
                        realizedPnL: 0
                    }], options);
                } else {
                    position.buyQuantity += qty;
                    position.buyValue = roundMoney(position.buyValue + executionValue);
                    await position.save(options);
                }

                // Create Trade execution audit record
                const trades = await TradeModel.create([{
                    userId,
                    orderId: freshOrder._id,
                    instrumentSymbol: symbol,
                    side: 'BUY',
                    quantity: qty,
                    price: fillPrice,
                    value: executionValue,
                    charges: 0.00
                }], options);

                // Create Ledger settlement record
                await LedgerModel.create([{
                    userId,
                    type: 'BUY_SETTLEMENT',
                    amount: executionValue,
                    balanceAfter: roundMoney(account.totalBalance - account.blockedBalance),
                    referenceId: trades[0]._id.toString()
                }], options);

                // Update Order status
                freshOrder.status = 'FILLED';
                freshOrder.filledQuantity = qty;
                freshOrder.executionPrice = fillPrice;
                freshOrder.reservedAmount = 0;
                await freshOrder.save(options);

            } else if (freshOrder.side === 'SELL') {
                let holding = await HoldingModel.findOne({ userId, instrumentSymbol: symbol }, null, options);
                if (!holding || holding.quantity < qty) {
                    freshOrder.status = 'REJECTED';
                    freshOrder.reservedQuantity = 0;
                    await freshOrder.save(options);
                    return;
                }

                // Release quantity reservation
                holding.blockedQuantity = Math.max(0, holding.blockedQuantity - freshOrder.reservedQuantity);

                // Calculate realized P&L using original average cost
                const realizedPnL = calcRealizedPnL(qty, fillPrice, holding.avgPrice);

                holding.quantity -= qty;
                if (holding.quantity <= 0) {
                    await HoldingModel.deleteOne({ _id: holding._id }, options);
                } else {
                    await holding.save(options);
                }

                // Settle cash proceeds: credit totalBalance
                account.totalBalance = roundMoney(account.totalBalance + executionValue);
                await account.save(options);

                // Settle Position
                let position = await PositionModel.findOne({ userId, instrumentSymbol: symbol }, null, options);
                if (!position) {
                    await PositionModel.create([{
                        userId,
                        instrumentSymbol: symbol,
                        buyQuantity: 0,
                        sellQuantity: qty,
                        buyValue: 0,
                        sellValue: executionValue,
                        realizedPnL: realizedPnL
                    }], options);
                } else {
                    position.sellQuantity += qty;
                    position.sellValue = roundMoney(position.sellValue + executionValue);
                    position.realizedPnL = roundMoney(position.realizedPnL + realizedPnL);
                    await position.save(options);
                }

                // Create Trade execution audit record
                const trades = await TradeModel.create([{
                    userId,
                    orderId: freshOrder._id,
                    instrumentSymbol: symbol,
                    side: 'SELL',
                    quantity: qty,
                    price: fillPrice,
                    value: executionValue,
                    charges: 0.00
                }], options);

                // Create Ledger settlement record
                await LedgerModel.create([{
                    userId,
                    type: 'SELL_PROCEEDS',
                    amount: executionValue,
                    balanceAfter: roundMoney(account.totalBalance - account.blockedBalance),
                    referenceId: trades[0]._id.toString()
                }], options);

                // Update Order status
                freshOrder.status = 'FILLED';
                freshOrder.filledQuantity = qty;
                freshOrder.executionPrice = fillPrice;
                freshOrder.reservedQuantity = 0;
                await freshOrder.save(options);
            }
        };

        if (checkReplicaSet()) {
            await withTransaction(performExecution);
        } else {
            await performExecution(null);
        }
    }
}

const executionEngineInstance = new ExecutionEngine();

module.exports = {
    executionEngineInstance,
    ExecutionEngine
};
