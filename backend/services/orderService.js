const { OrderModel } = require('../models/Order');
const { AccountModel } = require('../models/Account');
const { HoldingModel } = require('../models/Holding');
const { LedgerModel } = require('../models/Ledger');
const { simulatorInstance } = require('./marketSimulator');
const MarketCalendarService = require('./marketCalendarService');
const { calcValue, roundMoney } = require('../utils/moneyUtils');
const { withTransaction, checkReplicaSet } = require('../config/db');

async function placeOrder(userId, orderData) {
    const { instrumentSymbol, side, quantity, orderType, price: inputPrice, idempotencyKey } = orderData;

    if (!instrumentSymbol || !side || !quantity || !orderType || !idempotencyKey) {
        const err = new Error('Missing required order parameters');
        err.statusCode = 400;
        throw err;
    }

    const qty = Math.floor(Number(quantity));
    if (isNaN(qty) || qty <= 0) {
        const err = new Error('Quantity must be a positive integer');
        err.statusCode = 400;
        throw err;
    }

    const symbol = instrumentSymbol.toUpperCase().trim();
    const inst = simulatorInstance.getInstrument(symbol);
    if (!inst) {
        const err = new Error(`Instrument ${symbol} not found`);
        err.statusCode = 404;
        throw err;
    }

    if (!['BUY', 'SELL'].includes(side)) {
        const err = new Error('Invalid order side. Must be BUY or SELL');
        err.statusCode = 400;
        throw err;
    }

    if (!['MARKET', 'LIMIT'].includes(orderType)) {
        const err = new Error('Invalid order type. Must be MARKET or LIMIT');
        err.statusCode = 400;
        throw err;
    }

    // Market Closed Rejection Rule for LIVE mode
    if (inst.mode === 'LIVE' && orderType === 'MARKET') {
        const marketState = MarketCalendarService.getMarketState(new Date(), inst.exchange || 'NSE');
        if (marketState === 'CLOSED') {
            const err = new Error(`Market is currently closed for ${inst.exchange || 'NSE'}. MARKET orders cannot be executed outside active trading hours.`);
            err.statusCode = 400;
            throw err;
        }
    }

    let targetPrice = roundMoney(inputPrice);
    if (orderType === 'MARKET') {
        targetPrice = inst.lastPrice;
    } else if (!targetPrice || targetPrice <= 0) {
        const err = new Error('Limit price must be greater than 0 for LIMIT orders');
        err.statusCode = 400;
        throw err;
    }

    // Scoped idempotency check
    const existingOrder = await OrderModel.findOne({ userId, idempotencyKey });
    if (existingOrder) {
        return existingOrder;
    }

    let createdOrder;

    const performOrderPlacement = async (session) => {
        const options = session ? { session } : {};

        if (side === 'BUY') {
            const requiredFunds = calcValue(qty, targetPrice);

            // Fetch account to verify existence
            const account = await AccountModel.findOne({ userId }, null, options);
            if (!account) {
                const err = new Error('User account not found');
                err.statusCode = 404;
                throw err;
            }

            const availableCash = roundMoney(account.totalBalance - account.blockedBalance);
            if (availableCash < requiredFunds) {
                const err = new Error(`Insufficient spendable funds. Required: ₹${requiredFunds.toFixed(2)}, Available: ₹${availableCash.toFixed(2)}`);
                err.statusCode = 400;
                throw err;
            }

            // Atomic cash reservation condition query
            const updatedAccount = await AccountModel.findOneAndUpdate(
                {
                    userId,
                    $expr: {
                        $gte: [
                            { $subtract: ["$totalBalance", "$blockedBalance"] },
                            requiredFunds
                        ]
                    }
                },
                { $inc: { blockedBalance: requiredFunds } },
                { new: true, ...options }
            );

            if (!updatedAccount) {
                const err = new Error(`Insufficient spendable funds under concurrent request.`);
                err.statusCode = 400;
                throw err;
            }

            // Create Order
            const orders = await OrderModel.create([{
                userId,
                instrumentSymbol: symbol,
                side: 'BUY',
                quantity: qty,
                filledQuantity: 0,
                orderType,
                price: targetPrice,
                status: 'OPEN',
                reservedAmount: requiredFunds,
                reservedQuantity: 0,
                idempotencyKey
            }], options);

            createdOrder = orders[0];

            // Ledger reservation audit entry
            await LedgerModel.create([{
                userId,
                type: 'BUY_RESERVATION',
                amount: requiredFunds,
                balanceAfter: roundMoney(updatedAccount.totalBalance - updatedAccount.blockedBalance),
                referenceId: createdOrder._id.toString()
            }], options);

        } else if (side === 'SELL') {
            const holding = await HoldingModel.findOne({ userId, instrumentSymbol: symbol }, null, options);
            const ownedQuantity = holding ? holding.quantity : 0;
            const blockedQuantity = holding ? holding.blockedQuantity : 0;
            const sellableQuantity = Math.max(0, ownedQuantity - blockedQuantity);

            if (sellableQuantity < qty) {
                const err = new Error(`Insufficient sellable quantity. Required: ${qty}, Sellable: ${sellableQuantity}`);
                err.statusCode = 400;
                throw err;
            }

            // Atomic quantity reservation condition query
            const updatedHolding = await HoldingModel.findOneAndUpdate(
                {
                    userId,
                    instrumentSymbol: symbol,
                    $expr: {
                        $gte: [
                            { $subtract: ["$quantity", "$blockedQuantity"] },
                            qty
                        ]
                    }
                },
                { $inc: { blockedQuantity: qty } },
                { new: true, ...options }
            );

            if (!updatedHolding) {
                const err = new Error(`Insufficient sellable quantity under concurrent request.`);
                err.statusCode = 400;
                throw err;
            }

            // Create Order
            const orders = await OrderModel.create([{
                userId,
                instrumentSymbol: symbol,
                side: 'SELL',
                quantity: qty,
                filledQuantity: 0,
                orderType,
                price: targetPrice,
                status: 'OPEN',
                reservedAmount: 0,
                reservedQuantity: qty,
                idempotencyKey
            }], options);

            createdOrder = orders[0];
        }
    };

    if (checkReplicaSet()) {
        await withTransaction(performOrderPlacement);
    } else {
        await performOrderPlacement(null);
    }

    return createdOrder;
}

async function cancelOrder(userId, orderId) {
    let cancelledOrder;

    const performCancellation = async (session) => {
        const options = session ? { session } : {};

        const order = await OrderModel.findOne({ _id: orderId, userId }, null, options);
        if (!order) {
            const err = new Error('Order not found');
            err.statusCode = 404;
            throw err;
        }

        if (order.status !== 'OPEN') {
            const err = new Error(`Order cannot be cancelled in state ${order.status}`);
            err.statusCode = 400;
            throw err;
        }

        if (order.side === 'BUY' && order.reservedAmount > 0) {
            const account = await AccountModel.findOneAndUpdate(
                { userId },
                { $inc: { blockedBalance: -order.reservedAmount } },
                { new: true, ...options }
            );

            if (account) {
                await LedgerModel.create([{
                    userId,
                    type: 'CANCEL_RELEASE',
                    amount: order.reservedAmount,
                    balanceAfter: roundMoney(account.totalBalance - account.blockedBalance),
                    referenceId: order._id.toString()
                }], options);
            }
            order.reservedAmount = 0;
        } else if (order.side === 'SELL' && order.reservedQuantity > 0) {
            await HoldingModel.findOneAndUpdate(
                { userId, instrumentSymbol: order.instrumentSymbol },
                { $inc: { blockedQuantity: -order.reservedQuantity } },
                { ...options }
            );
            order.reservedQuantity = 0;
        }

        order.status = 'CANCELLED';
        await order.save(options);
        cancelledOrder = order;
    };

    if (checkReplicaSet()) {
        await withTransaction(performCancellation);
    } else {
        await performCancellation(null);
    }

    return cancelledOrder;
}

module.exports = {
    placeOrder,
    cancelOrder
};
