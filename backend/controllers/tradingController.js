const { marketDataManagerInstance } = require('../services/marketData/MarketDataManager');
const { placeOrder, cancelOrder } = require('../services/orderService');
const { InstrumentModel } = require('../models/Instrument');
const { OrderModel } = require('../models/Order');
const { TradeModel } = require('../models/Trade');
const { HoldingModel } = require('../models/Holding');
const { PositionModel } = require('../models/Position');
const { AccountModel } = require('../models/Account');
const { LedgerModel } = require('../models/Ledger');
const { WatchlistModel } = require('../models/Watchlist');
const { calcUnrealizedPnL, calcValue, roundMoney } = require('../utils/moneyUtils');

function getProvider() {
    return marketDataManagerInstance.getProvider();
}

async function getInstruments(req, res) {
    const provider = getProvider();
    const instruments = provider.getAllInstruments();
    res.status(200).json(instruments);
}

async function searchInstruments(req, res) {
    const rawQuery = req.query.q || '';
    const queryStr = decodeURIComponent(rawQuery).trim();
    const provider = getProvider();

    if (!queryStr) {
        return res.status(200).json(provider.getAllInstruments().slice(0, 10));
    }

    const regex = new RegExp(queryStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    // Query Instrument Master DB across symbol, companyName, sector, and searchableAliases
    const dbMatches = await InstrumentModel.find({
        $or: [
            { symbol: regex },
            { companyName: regex },
            { sector: regex },
            { searchableAliases: regex }
        ]
    });

    const result = dbMatches.map(doc => {
        const snap = provider.getInstrument(doc.symbol);
        return snap || {
            symbol: doc.symbol,
            companyName: doc.companyName,
            name: doc.companyName,
            exchange: doc.exchange,
            instrumentType: doc.instrumentType,
            sector: doc.sector,
            lastPrice: doc.referencePrice,
            changePercent: 0
        };
    });

    res.status(200).json(result);
}

async function getWatchlist(req, res) {
    let watchlist = await WatchlistModel.findOne({ userId: req.user.id });
    if (!watchlist) {
        watchlist = await WatchlistModel.create({
            userId: req.user.id,
            symbols: ['RELIANCE', 'INFY', 'TCS', 'HDFCBANK', 'ICICIBANK', 'WIPRO', 'TATAPOWER', 'ITC', 'M&M', 'BHARTIARTL']
        });
    }

    const provider = getProvider();
    const result = watchlist.symbols.map(symbol => {
        const inst = provider.getInstrument(symbol);
        return inst || { symbol, name: symbol, companyName: symbol, lastPrice: 0, changePercent: 0 };
    });

    res.status(200).json(result);
}

async function addToWatchlist(req, res) {
    const { symbol } = req.body;
    if (!symbol) {
        return res.status(400).json({ message: 'Symbol is required' });
    }

    const upperSymbol = decodeURIComponent(symbol).toUpperCase().trim();
    let watchlist = await WatchlistModel.findOne({ userId: req.user.id });
    if (!watchlist) {
        watchlist = new WatchlistModel({ userId: req.user.id, symbols: [] });
    }

    if (!watchlist.symbols.includes(upperSymbol)) {
        watchlist.symbols.push(upperSymbol);
        await watchlist.save();
    }

    res.status(200).json({ message: 'Added to watchlist', symbols: watchlist.symbols });
}

async function removeFromWatchlist(req, res) {
    const { symbol } = req.body;
    if (!symbol) {
        return res.status(400).json({ message: 'Symbol is required' });
    }

    const upperSymbol = decodeURIComponent(symbol).toUpperCase().trim();
    let watchlist = await WatchlistModel.findOne({ userId: req.user.id });
    if (watchlist) {
        watchlist.symbols = watchlist.symbols.filter(s => s !== upperSymbol);
        await watchlist.save();
    }

    res.status(200).json({ message: 'Removed from watchlist', symbols: watchlist ? watchlist.symbols : [] });
}

async function reorderWatchlist(req, res) {
    const { symbols } = req.body;
    if (!Array.isArray(symbols)) {
        return res.status(400).json({ message: 'Symbols must be an array' });
    }

    let watchlist = await WatchlistModel.findOne({ userId: req.user.id });
    if (!watchlist) {
        watchlist = new WatchlistModel({
            userId: req.user.id,
            symbols: ['RELIANCE', 'INFY', 'TCS', 'HDFCBANK', 'ICICIBANK']
        });
        await watchlist.save();
    }

    const cleanSymbols = symbols.map(s => decodeURIComponent(s).toUpperCase().trim());

    // Validate that every submitted symbol belongs to the user's existing favorites
    const currentSet = new Set(watchlist.symbols);
    for (const sym of cleanSymbols) {
        if (!currentSet.has(sym)) {
            return res.status(400).json({ message: `Symbol ${sym} is not in your current favorites` });
        }
    }

    // Preserve exact requested order
    watchlist.symbols = cleanSymbols;
    await watchlist.save();

    res.status(200).json({ message: 'Watchlist reordered successfully', symbols: watchlist.symbols });
}

async function handlePlaceOrder(req, res) {
    const order = await placeOrder(req.user.id, req.body);
    res.status(201).json({ message: 'Order submitted successfully', order });
}

async function handleCancelOrder(req, res) {
    const orderId = req.params.id;
    const order = await cancelOrder(req.user.id, orderId);
    res.status(200).json({ message: 'Order cancelled successfully', order });
}

async function getOrders(req, res) {
    const orders = await OrderModel.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(orders);
}

async function getTrades(req, res) {
    const trades = await TradeModel.find({ userId: req.user.id }).sort({ timestamp: -1 });
    res.status(200).json(trades);
}

async function getHoldings(req, res) {
    const holdings = await HoldingModel.find({ userId: req.user.id });
    const provider = getProvider();

    const result = holdings.map(h => {
        const inst = provider.getInstrument(h.instrumentSymbol) || { lastPrice: h.avgPrice, changePercent: 0 };
        const ltp = inst.lastPrice;
        const currValue = calcValue(h.quantity, ltp);
        const investedValue = calcValue(h.quantity, h.avgPrice);
        const unrealizedPnL = calcUnrealizedPnL(h.quantity, ltp, h.avgPrice);
        const netChange = h.avgPrice > 0 ? roundMoney(((ltp - h.avgPrice) / h.avgPrice) * 100) : 0;

        return {
            _id: h._id,
            name: h.instrumentSymbol,
            qty: h.quantity,
            blockedQty: h.blockedQuantity,
            sellableQty: h.sellableQuantity,
            avg: h.avgPrice,
            price: ltp,
            currValue,
            investedValue,
            pnl: unrealizedPnL,
            net: `${netChange >= 0 ? '+' : ''}${netChange.toFixed(2)}%`,
            day: `${inst.changePercent >= 0 ? '+' : ''}${inst.changePercent.toFixed(2)}%`,
            isLoss: unrealizedPnL < 0
        };
    });

    res.status(200).json(result);
}

async function getPositions(req, res) {
    const positions = await PositionModel.find({ userId: req.user.id });
    const provider = getProvider();

    const result = positions.map(p => {
        const inst = provider.getInstrument(p.instrumentSymbol) || { lastPrice: 0, changePercent: 0 };
        const ltp = inst.lastPrice;
        const netQty = p.netQuantity;
        const unrealizedPnL = netQty !== 0 ? calcValue(netQty, ltp) - (p.buyValue - p.sellValue) : 0;
        const totalPnL = roundMoney(p.realizedPnL + unrealizedPnL);

        return {
            _id: p._id,
            product: 'CNC',
            name: p.instrumentSymbol,
            qty: netQty,
            buyQty: p.buyQuantity,
            sellQty: p.sellQuantity,
            avg: p.buyQuantity > 0 ? roundMoney(p.buyValue / p.buyQuantity) : 0,
            price: ltp,
            netPnL: totalPnL,
            realizedPnL: p.realizedPnL,
            day: `${inst.changePercent >= 0 ? '+' : ''}${inst.changePercent.toFixed(2)}%`,
            isLoss: totalPnL < 0
        };
    });

    res.status(200).json(result);
}

async function getFunds(req, res) {
    let account = await AccountModel.findOne({ userId: req.user.id });
    if (!account) {
        account = await AccountModel.create({ userId: req.user.id, totalBalance: 100000.00, blockedBalance: 0.00 });
    }

    const ledger = await LedgerModel.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);

    res.status(200).json({
        totalBalance: account.totalBalance,
        blockedBalance: account.blockedBalance,
        availableBalance: account.availableBalance,
        ledger
    });
}

async function getSummary(req, res) {
    let account = await AccountModel.findOne({ userId: req.user.id });
    if (!account) {
        account = await AccountModel.create({ userId: req.user.id, totalBalance: 100000.00, blockedBalance: 0.00 });
    }

    const holdings = await HoldingModel.find({ userId: req.user.id });
    const provider = getProvider();

    let totalInvestment = 0;
    let currentValue = 0;
    let totalUnrealizedPnL = 0;

    holdings.forEach(h => {
        const inst = provider.getInstrument(h.instrumentSymbol) || { lastPrice: h.avgPrice };
        const ltp = inst.lastPrice;

        const inv = calcValue(h.quantity, h.avgPrice);
        const cur = calcValue(h.quantity, ltp);

        totalInvestment += inv;
        currentValue += cur;
        totalUnrealizedPnL += (cur - inv);
    });

    totalInvestment = roundMoney(totalInvestment);
    currentValue = roundMoney(currentValue);
    totalUnrealizedPnL = roundMoney(totalUnrealizedPnL);
    const pnlPercentage = totalInvestment > 0 ? roundMoney((totalUnrealizedPnL / totalInvestment) * 100) : 0;

    res.status(200).json({
        availableMargin: account.availableBalance,
        usedMargin: account.blockedBalance,
        totalBalance: account.totalBalance,
        holdingsCount: holdings.length,
        totalInvestment,
        currentValue,
        totalPnL: totalUnrealizedPnL,
        pnlPercentage
    });
}

async function getAnalytics(req, res) {
    const trades = await TradeModel.find({ userId: req.user.id });
    const positions = await PositionModel.find({ userId: req.user.id });
    const provider = getProvider();

    let totalRealizedPnL = 0;
    positions.forEach(p => {
        totalRealizedPnL += p.realizedPnL;
    });

    const holdings = await HoldingModel.find({ userId: req.user.id });
    let totalUnrealizedPnL = 0;
    holdings.forEach(h => {
        const inst = provider.getInstrument(h.instrumentSymbol) || { lastPrice: h.avgPrice };
        totalUnrealizedPnL += (calcValue(h.quantity, inst.lastPrice) - calcValue(h.quantity, h.avgPrice));
    });

    let winningTrades = 0;
    let losingTrades = 0;

    positions.forEach(p => {
        if (p.realizedPnL > 0) winningTrades++;
        else if (p.realizedPnL < 0) losingTrades++;
    });

    const totalClosedTrades = winningTrades + losingTrades;
    const winRate = totalClosedTrades > 0 ? roundMoney((winningTrades / totalClosedTrades) * 100) : 0;

    res.status(200).json({
        totalTrades: trades.length,
        winningTrades,
        losingTrades,
        winRate,
        totalRealizedPnL: roundMoney(totalRealizedPnL),
        totalUnrealizedPnL: roundMoney(totalUnrealizedPnL),
        totalPnL: roundMoney(totalRealizedPnL + totalUnrealizedPnL)
    });
}

module.exports = {
    getInstruments,
    searchInstruments,
    getWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    reorderWatchlist,
    handlePlaceOrder,
    handleCancelOrder,
    getOrders,
    getTrades,
    getHoldings,
    getPositions,
    getFunds,
    getSummary,
    getAnalytics
};
