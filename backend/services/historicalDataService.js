const { OHLCModel } = require('../models/OHLC');
const { InstrumentModel } = require('../models/Instrument');
const MarketCalendarService = require('./marketCalendarService');
const { roundMoney } = require('../utils/moneyUtils');

// Symbol Mapping Table for Provider Tickers
const SYMBOL_MAP = {
    'NIFTY50': { providerSymbol: '^NSEI', exchange: 'NSE' },
    'BANKNIFTY': { providerSymbol: '^NSEBANK', exchange: 'NSE' },
    'SENSEX': { providerSymbol: '^BSESN', exchange: 'BSE' }
};

// In-Memory Query Cache with 5-minute TTL
const queryCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function clearHistoricalCache() {
    queryCache.clear();
    console.log('[HistoricalDataService] Cache invalidated.');
}

function getProviderSymbolMapping(symbol) {
    const upper = (symbol || '').toUpperCase().trim();
    if (SYMBOL_MAP[upper]) {
        return SYMBOL_MAP[upper];
    }
    return {
        providerSymbol: upper === 'M&M' ? 'M%26M.NS' : `${upper}.NS`,
        exchange: 'NSE'
    };
}

/**
 * Calculates start and end dates based on range parameters or explicit from/to dates.
 */
function resolveDateBounds(range, from, to) {
    if (from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            const err = new Error('Invalid from or to date format. Expected ISO date string.');
            err.statusCode = 400;
            throw err;
        }

        if (fromDate > toDate) {
            const err = new Error('Invalid date range: "from" date must be earlier than or equal to "to" date.');
            err.statusCode = 400;
            throw err;
        }

        return {
            startDate: MarketCalendarService.normalizeToISTMidnight(fromDate),
            endDate: MarketCalendarService.normalizeToISTMidnight(toDate),
            isMax: false
        };
    }

    const normRange = (range || '1M').toUpperCase().trim();
    const endDate = MarketCalendarService.normalizeToISTMidnight(new Date());
    let startDate = new Date(endDate);

    switch (normRange) {
        case '1D':
            startDate.setDate(endDate.getDate() - 5);
            break;
        case '1W':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case '1M':
            startDate.setMonth(endDate.getMonth() - 1);
            break;
        case '3M':
            startDate.setMonth(endDate.getMonth() - 3);
            break;
        case '6M':
            startDate.setMonth(endDate.getMonth() - 6);
            break;
        case '1Y':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        case '5Y':
            startDate.setFullYear(endDate.getFullYear() - 5);
            break;
        case 'MAX':
            return { startDate: null, endDate: null, isMax: true };
        default:
            startDate.setMonth(endDate.getMonth() - 1);
            break;
    }

    return {
        startDate: MarketCalendarService.normalizeToISTMidnight(startDate),
        endDate,
        isMax: false
    };
}

/**
 * Dynamically aggregates daily candles into Weekly (1W) or Monthly (1M) candles.
 * Explicit Rules:
 * open = first trading candle's open
 * high = max high
 * low = min low
 * close = last trading candle's close
 * volume = sum of volumes (using reduce accumulator)
 */
function aggregateCandles(dailyCandles, targetInterval) {
    if (!['1W', '1M'].includes(targetInterval)) {
        return dailyCandles;
    }

    const groups = new Map();

    for (const c of dailyCandles) {
        const d = new Date(c.timestamp);
        let groupKey;

        if (targetInterval === '1W') {
            const firstJan = new Date(d.getFullYear(), 0, 1);
            const dayNum = Math.floor((d - firstJan) / 86400000);
            const weekNum = Math.ceil((dayNum + firstJan.getDay() + 1) / 7);
            groupKey = `${d.getFullYear()}-W${weekNum}`;
        } else if (targetInterval === '1M') {
            groupKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        groups.get(groupKey).push(c);
    }

    const aggregated = [];
    for (const [key, candles] of groups.entries()) {
        candles.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const first = candles[0];
        const last = candles[candles.length - 1];

        const high = candles.reduce((max, c) => Math.max(max, c.high), first.high);
        const low = candles.reduce((min, c) => Math.min(min, c.low), first.low);
        const totalVolume = candles.reduce((acc, c) => acc + (Number(c.volume) || 0), 0);

        aggregated.push({
            symbol: first.symbol,
            exchange: first.exchange,
            interval: targetInterval,
            timestamp: first.timestamp,
            open: first.open,
            high: roundMoney(high),
            low: roundMoney(low),
            close: last.close,
            volume: totalVolume
        });
    }

    return aggregated;
}

/**
 * Primary Historical Data Query Service
 */
async function getHistoricalOHLC(symbol, options = {}) {
    const rawSymbol = decodeURIComponent(symbol || '').toUpperCase().trim();
    const { marketDataManagerInstance } = require('./marketData/MarketDataManager');
    const provider = marketDataManagerInstance.getProvider();
    const liveInst = provider ? provider.getInstrument(rawSymbol) : null;

    let inst = liveInst;
    if (!inst && process.env.MARKET_DATA_MODE === 'SIMULATION') {
        inst = { symbol: rawSymbol, lastPrice: 100, referencePrice: 100, companyName: rawSymbol, exchange: 'NSE' };
    } else if (!inst) {
        inst = await InstrumentModel.findOne({ symbol: rawSymbol });
    }
    if (!inst) {
        const err = new Error(`Instrument "${rawSymbol}" not found in Instrument Master.`);
        err.statusCode = 404;
        throw err;
    }

    const interval = (options.interval || '1D').toUpperCase().trim();
    const normRange = (options.range || '1M').toUpperCase().trim();

    // 1H simulated intraday chart handler (most recent up to 60 1m candles)
    if (normRange === '1H') {
        const intradayCandleService = require('./marketData/IntradayCandleService');
        const { marketDataManagerInstance } = require('./marketData/MarketDataManager');
        const provider = marketDataManagerInstance.getProvider();
        const liveInst = provider ? provider.getInstrument(rawSymbol) : null;
        
        const instParam = liveInst || {
            symbol: rawSymbol,
            lastPrice: inst.lastPrice || inst.referencePrice,
            referencePrice: inst.referencePrice,
            companyName: inst.companyName,
            exchange: inst.exchange,
            instrumentType: inst.instrumentType
        };

        const all1mCandles = intradayCandleService.getCandles(instParam, '1m');
        const candles = all1mCandles.slice(-60);
        
        return {
            symbol: rawSymbol,
            companyName: inst.companyName,
            exchange: inst.exchange,
            instrumentType: inst.instrumentType,
            interval: '1m',
            range: '1H',
            count: candles.length,
            data: candles
        };
    }

    // 1D simulated intraday chart handler (supports 1m and 15m intervals)
    const is1DIntraday = normRange === '1D' || ['1M', '1m', '15M', '15m'].includes(options.interval);
    if (is1DIntraday) {
        const targetInterval = (options.interval || '15m').toLowerCase().trim() === '1m' ? '1m' : '15m';
        const intradayCandleService = require('./marketData/IntradayCandleService');
        const { marketDataManagerInstance } = require('./marketData/MarketDataManager');
        const provider = marketDataManagerInstance.getProvider();
        const liveInst = provider ? provider.getInstrument(rawSymbol) : null;
        
        const instParam = liveInst || {
            symbol: rawSymbol,
            lastPrice: inst.lastPrice || inst.referencePrice,
            referencePrice: inst.referencePrice,
            companyName: inst.companyName,
            exchange: inst.exchange,
            instrumentType: inst.instrumentType
        };

        const candles = intradayCandleService.getCandles(instParam, targetInterval);
        
        return {
            symbol: rawSymbol,
            companyName: inst.companyName,
            exchange: inst.exchange,
            instrumentType: inst.instrumentType,
            interval: targetInterval,
            range: '1D',
            count: candles.length,
            data: candles
        };
    }

    const unsupportedIntraday = ['5M', '30M', '1H'];
    if (unsupportedIntraday.includes(interval)) {
        const err = new Error(`Intraday interval "${interval}" is not available without live intraday feed subscription.`);
        err.statusCode = 400;
        err.errorCode = 'UNSUPPORTED_INTERVAL';
        throw err;
    }

    if (!['1D', '1W', '1M'].includes(interval)) {
        const err = new Error(`Invalid interval "${interval}". Supported intervals are 1D, 1W, 1M.`);
        err.statusCode = 400;
        throw err;
    }
    const defaultLimit = normRange === 'MAX' ? 1000 : 500;
    const limit = Math.min(Math.max(1, Number(options.limit) || defaultLimit), 1000);
    if (options.limit && Number(options.limit) > 1000) {
        const err = new Error('Limit cannot exceed 1000 candles per query.');
        err.statusCode = 400;
        throw err;
    }

    const { range, from, to } = options;
    const { startDate, endDate, isMax } = resolveDateBounds(range, from, to);

    // Cache lookup
    const cacheKey = `OHLC:${rawSymbol}:${interval}:${range || '1M'}:${from || ''}:${to || ''}:${limit}`;
    const cached = queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt < CACHE_TTL_MS)) {
        return cached.payload;
    }

    // Build MongoDB query
    const query = { symbol: rawSymbol, interval: '1D' };
    if (!isMax && startDate && endDate) {
        query.timestamp = { $gte: startDate, $lte: endDate };
    }

    // Execute query sorted chronologically
    const rawCandles = await OHLCModel.find(query).sort({ timestamp: 1 }).limit(1000);

    // Aggregate if interval is 1W or 1M
    let finalCandles = aggregateCandles(rawCandles, interval);
    if (finalCandles.length > limit) {
        finalCandles = finalCandles.slice(finalCandles.length - limit);
    }

    const payload = {
        symbol: rawSymbol,
        companyName: inst.companyName,
        exchange: inst.exchange,
        instrumentType: inst.instrumentType,
        interval,
        range: isMax ? 'MAX' : (range || '1M'),
        count: finalCandles.length,
        data: finalCandles.map(c => ({
            timestamp: c.timestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            source: c.source || 'YAHOO_FINANCE'
        }))
    };

    // Store in cache
    queryCache.set(cacheKey, { payload, cachedAt: Date.now() });

    return payload;
}

module.exports = {
    getHistoricalOHLC,
    getProviderSymbolMapping,
    clearHistoricalCache,
    aggregateCandles,
    resolveDateBounds
};
