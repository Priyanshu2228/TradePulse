const MarketDataProvider = require('./MarketDataProvider');
const { InstrumentModel } = require('../../models/Instrument');
const { seedInstruments } = require('../instrumentSeedService');
const { NSEPublicQuoteAdapter } = require('./adapters/NSEPublicQuoteAdapter');
const { TrueDataMarketDataAdapter } = require('./adapters/TrueDataMarketDataAdapter');
const MarketCalendarService = require('../marketCalendarService');
const { roundMoney } = require('../../utils/moneyUtils');

class RealMarketDataProvider extends MarketDataProvider {
    constructor(options = {}) {
        super();
        this.prices = new Map();
        
        // Provider Selection Logic:
        // Default to TRUEDATA if TRUEDATA_USERNAME is set or MARKET_DATA_PROVIDER === 'TRUEDATA'.
        // Fall back to DEV_UNOFFICIAL adapter ONLY if explicitly configured or in local sandbox dev.
        const providerName = options.provider || process.env.MARKET_DATA_PROVIDER || (process.env.TRUEDATA_USERNAME ? 'TRUEDATA' : 'DEV_UNOFFICIAL');

        if (providerName === 'TRUEDATA') {
            this.adapter = new TrueDataMarketDataAdapter(options);
            this.providerName = 'TRUEDATA';
        } else {
            this.adapter = new NSEPublicQuoteAdapter();
            this.providerName = 'DEV_UNOFFICIAL';
        }

        this.pollTimer = null;
        this.staleCheckTimer = null;
        this.executionEngineCallback = null;

        // State Machine
        this.connectionState = 'DISCONNECTED'; // DISCONNECTED | CONNECTING | CONNECTED | AUTHENTICATION_FAILED | RECONNECTING
        this.marketStatus = 'CLOSED';           // OPEN | PRE_OPEN | CLOSED
        this.isStale = false;
        this.lastTickTimestamp = 0;
        this.staleThresholdMs = parseInt(process.env.MARKET_DATA_STALE_THRESHOLD_MS || '10000', 10);
        this.pollIntervalMs = parseInt(process.env.MARKET_DATA_POLL_INTERVAL_MS || '3000', 10);
        this.isExplicitlyStopped = false;
    }

    getMode() {
        return 'LIVE';
    }

    async init() {
        // 1. Seed instruments into DB if needed
        await seedInstruments();

        // 2. Populate initial instruments map
        const instruments = await InstrumentModel.find({});
        for (const inst of instruments) {
            const data = this._formatSnapshot({
                symbol: inst.symbol,
                companyName: inst.companyName,
                exchange: inst.exchange || 'NSE',
                instrumentType: inst.instrumentType,
                lastPrice: roundMoney(inst.lastPrice || inst.referencePrice),
                open: roundMoney(inst.open || inst.referencePrice),
                high: roundMoney(inst.high || inst.referencePrice),
                low: roundMoney(inst.low || inst.referencePrice),
                close: roundMoney(inst.close || inst.referencePrice),
                volume: inst.volume || 0
            });
            this.prices.set(inst.symbol, data);
        }

        // 3. Test initial live quote fetch
        try {
            this.connectionState = 'CONNECTING';
            const allSymbols = Array.from(this.prices.keys());

            if (typeof this.adapter.init === 'function') {
                await this.adapter.init();
            }

            if (typeof this.adapter.onTick === 'function') {
                this.adapter.onTick((ticks) => this._applyQuotes(ticks));
            }

            if (typeof this.adapter.subscribe === 'function') {
                this.adapter.subscribe(allSymbols);
            }

            // Attempt initial quote fetch
            const initialQuotes = await this.adapter.fetchQuotes(allSymbols);
            this.connectionState = 'CONNECTED';
            this.reconnectAttempts = 0;
            console.log(`[RealMarketDataProvider] Connected to ${this.providerName} Market Feed. Received ${initialQuotes.length} initial quotes.`);

            this._applyQuotes(initialQuotes);
        } catch (err) {
            this.connectionState = 'AUTHENTICATION_FAILED';
            console.error(`[RealMarketDataProvider] Live market data initialization failed (${this.providerName}): ${err.message}`);
            throw err; // Strict Policy: Fail clearly on startup. Never silently fallback to simulation.
        }
    }

    setExecutionEngineCallback(callback) {
        this.executionEngineCallback = callback;
    }

    start() {
        this.isExplicitlyStopped = false;
        this._startPolling();
        this._startStaleMonitoring();
    }

    stop() {
        this.isExplicitlyStopped = true;
        this._stopPolling();
        this._stopStaleMonitoring();
        this.connectionState = 'DISCONNECTED';
        console.log('[RealMarketDataProvider] Live market feed stopped.');
    }

    getInstrument(symbol) {
        if (!symbol) return null;
        const upper = decodeURIComponent(symbol).toUpperCase().trim();
        let inst = this.prices.get(upper);

        if (!inst && upper === 'NIFTY 50') inst = this.prices.get('NIFTY50');
        if (!inst && upper === 'BANK NIFTY') inst = this.prices.get('BANKNIFTY');

        return inst;
    }

    getAllInstruments() {
        return Array.from(this.prices.values());
    }

    getAllPricesMap() {
        const map = {};
        for (const [symbol, inst] of this.prices.entries()) {
            map[symbol] = inst.lastPrice;
        }
        return map;
    }

    updatePrice(symbol, newPrice) {
        const inst = this.getInstrument(symbol);
        if (!inst) return null;

        inst.lastPrice = roundMoney(newPrice);
        inst.high = Math.max(inst.high, inst.lastPrice);
        inst.low = Math.min(inst.low, inst.lastPrice);
        inst.change = roundMoney(inst.lastPrice - inst.previousClose);
        inst.changePercent = inst.previousClose > 0 ? roundMoney(((inst.lastPrice - inst.previousClose) / inst.previousClose) * 100) : 0;
        inst.timestamp = Date.now();
        this.lastTickTimestamp = inst.timestamp;

        this.notifyListeners([inst]);
        if (this.executionEngineCallback) {
            this.executionEngineCallback(this.getAllPricesMap());
        }
        return inst;
    }

    _startPolling() {
        if (this.pollTimer) return;
        this.pollTimer = setInterval(async () => {
            await this._pollLiveQuotes();
        }, this.pollIntervalMs);
    }

    _stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    async _pollLiveQuotes() {
        if (this.isExplicitlyStopped) return;
        const state = MarketCalendarService.getMarketState(new Date(), 'NSE');
        this.marketStatus = state;

        // MARKET CLOSE FREEZE BEHAVIOR:
        // Do NOT fetch or modify prices when market is CLOSED or PRE_OPEN.
        // Prices remain frozen at last legitimate traded price!
        if (state !== 'OPEN') {
            return;
        }

        try {
            const allSymbols = Array.from(this.prices.keys());
            const quotes = await this.adapter.fetchQuotes(allSymbols);
            this.connectionState = 'CONNECTED';
            this._applyQuotes(quotes);
        } catch (err) {
            console.error('[RealMarketDataProvider] Live quote poll failed:', err.message);
            this.connectionState = 'RECONNECTING';
        }
    }

    _applyQuotes(quotes = []) {
        if (quotes.length === 0) return;

        const now = Date.now();
        this.lastTickTimestamp = now;
        const updated = [];

        for (const q of quotes) {
            const inst = this.prices.get(q.symbol);
            if (!inst) continue;

            inst.lastPrice = roundMoney(q.ltp);
            inst.previousClose = roundMoney(q.previousClose || inst.previousClose);
            inst.close = roundMoney(q.close || inst.close);
            inst.open = roundMoney(q.open || inst.open);
            inst.high = roundMoney(Math.max(inst.high, q.high || q.ltp));
            inst.low = roundMoney(Math.min(inst.low, q.low || q.ltp));
            inst.change = roundMoney(q.change !== undefined ? q.change : (q.ltp - inst.previousClose));
            inst.changePercent = inst.previousClose > 0 ? roundMoney(((inst.lastPrice - inst.previousClose) / inst.previousClose) * 100) : 0;
            inst.volume = q.volume || inst.volume;
            inst.timestamp = now;
            inst.source = 'LIVE';
            inst.feedType = 'DEVELOPMENT_UNOFFICIAL_FEED';
            inst.mode = 'LIVE';
            inst.connectionState = this.connectionState;
            inst.marketStatus = this.marketStatus;
            inst.isStale = this.isStale;

            updated.push(inst);
        }

        if (updated.length > 0) {
            this.notifyListeners(updated);
            if (this.executionEngineCallback) {
                this.executionEngineCallback(this.getAllPricesMap());
            }
        }
    }

    _startStaleMonitoring() {
        if (this.staleCheckTimer) return;
        this.staleCheckTimer = setInterval(() => {
            this._checkStaleAndMarketStatus();
        }, 5000);
    }

    _stopStaleMonitoring() {
        if (this.staleCheckTimer) {
            clearInterval(this.staleCheckTimer);
            this.staleCheckTimer = null;
        }
    }

    _checkStaleAndMarketStatus() {
        const state = MarketCalendarService.getMarketState(new Date(), 'NSE');
        this.marketStatus = state;

        const now = Date.now();
        if (this.marketStatus === 'OPEN') {
            this.isStale = (now - this.lastTickTimestamp) > this.staleThresholdMs;
        } else {
            // Outside market hours: Last known price is frozen & retained, not marked stale
            this.isStale = false;
        }

        // Broadcast status update to prices Map
        for (const inst of this.prices.values()) {
            inst.connectionState = this.connectionState;
            inst.marketStatus = this.marketStatus;
            inst.isStale = this.isStale;
        }
    }

    _formatSnapshot(raw) {
        const lastPrice = roundMoney(raw.lastPrice || 0);
        const close = roundMoney(raw.close || lastPrice);
        const state = MarketCalendarService.getMarketState(new Date(), 'NSE');

        return {
            symbol: raw.symbol,
            companyName: raw.companyName,
            exchange: raw.exchange || 'NSE',
            instrumentType: raw.instrumentType || 'EQUITY',
            lastPrice,
            previousClose: close,
            close,
            open: roundMoney(raw.open || lastPrice),
            high: roundMoney(raw.high || lastPrice),
            low: roundMoney(raw.low || lastPrice),
            change: roundMoney(lastPrice - close),
            changePercent: close > 0 ? roundMoney(((lastPrice - close) / close) * 100) : 0,
            volume: raw.volume || 0,
            timestamp: Date.now(),
            source: 'LIVE',
            mode: 'LIVE',
            connectionState: this.connectionState,
            marketStatus: state,
            isStale: false
        };
    }
}

module.exports = RealMarketDataProvider;
