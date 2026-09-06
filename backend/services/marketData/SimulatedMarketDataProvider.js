const MarketDataProvider = require('./MarketDataProvider');
const { InstrumentModel } = require('../../models/Instrument');
const { seedInstruments } = require('../instrumentSeedService');
const { roundMoney } = require('../../utils/moneyUtils');

class SimulatedMarketDataProvider extends MarketDataProvider {
    constructor() {
        super();
        this.prices = new Map();
        this.timer = null;
        this.executionEngineCallback = null;
    }

    getMode() {
        return 'SIMULATION';
    }

    async init() {
        // Idempotent seeding into DB
        await seedInstruments();

        const instruments = await InstrumentModel.find({});
        for (const inst of instruments) {
            const data = this._formatSnapshot({
                symbol: inst.symbol,
                companyName: inst.companyName,
                name: inst.companyName,
                exchange: inst.exchange || 'NSE',
                instrumentType: inst.instrumentType,
                type: inst.instrumentType,
                sector: inst.sector,
                industry: inst.industry,
                isin: inst.isin,
                tickSize: inst.tickSize,
                lotSize: inst.lotSize,
                referencePrice: inst.referencePrice,
                lastPrice: roundMoney(inst.lastPrice || inst.referencePrice),
                open: roundMoney(inst.open || inst.referencePrice),
                high: roundMoney(inst.high || inst.referencePrice),
                low: roundMoney(inst.low || inst.referencePrice),
                close: roundMoney(inst.close || inst.referencePrice),
                volume: inst.instrumentType === 'INDEX' ? 0 : (inst.volume || 100000)
            });
            this.prices.set(inst.symbol, data);
        }
        console.log(`[SimulatedMarketDataProvider] Initialized with ${this.prices.size} instruments in memory.`);
    }

    setExecutionEngineCallback(callback) {
        this.executionEngineCallback = callback;
    }

    start(intervalMs = 2000) {
        if (this.timer) return;

        this.timer = setInterval(() => {
            this.tick();
        }, intervalMs);
        console.log(`[SimulatedMarketDataProvider] Simulation tick loop started (${intervalMs}ms interval).`);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('[SimulatedMarketDataProvider] Tick loop stopped.');
        }
    }

    tick() {
        const MarketCalendarService = require('../marketCalendarService');
        const realState = MarketCalendarService.getMarketState(new Date(), 'NSE');
        const forceOpen = process.env.MARKET_SIMULATION_FORCE_OPEN === 'true';
        const effectiveState = forceOpen ? 'OPEN' : realState;

        // Market Session Freeze: Do NOT move simulated prices when market state is CLOSED or PRE_OPEN.
        if (effectiveState !== 'OPEN') {
            return;
        }

        const updated = [];
        for (const [symbol, inst] of this.prices.entries()) {
            const isIndex = inst.instrumentType === 'INDEX' || inst.type === 'INDEX';
            // Volatility Profile: Indices have lower delta, small/mid cap equities have higher delta
            const baseVolatility = isIndex ? 0.0005 : (inst.sector === 'IT' || inst.sector === 'Banking' ? 0.0015 : 0.0025);
            
            // Persistent momentum random walk
            inst.momentum = (inst.momentum || 0) * 0.7 + (Math.random() * 2 - 1) * 0.3;
            
            // Small drift towards reference price if drifting too far
            const refPrice = inst.referencePrice || inst.previousClose || inst.lastPrice;
            const drift = (refPrice - inst.lastPrice) * 0.0005;

            const deltaPercent = (inst.momentum + drift) * baseVolatility;
            let newPrice = roundMoney(inst.lastPrice * (1 + deltaPercent));

            // Reference Price Anchor Protection (prevent extreme price drift explosion > 30% from refPrice)
            if (refPrice > 0) {
                if (newPrice > refPrice * 1.30) newPrice = roundMoney(refPrice * 1.30);
                if (newPrice < refPrice * 0.70) newPrice = roundMoney(refPrice * 0.70);
            }

            // Non-negative price floor
            if (newPrice <= 0) newPrice = roundMoney(inst.lastPrice);

            inst.lastPrice = newPrice;
            inst.high = Math.max(inst.high, newPrice);
            inst.low = Math.min(inst.low, newPrice);
            inst.change = roundMoney(newPrice - inst.previousClose);
            inst.changePercent = inst.previousClose > 0 ? roundMoney(((newPrice - inst.previousClose) / inst.previousClose) * 100) : 0;
            if (!isIndex) {
                inst.volume += Math.floor(10 + Math.random() * 40);
            }
            inst.timestamp = Date.now();
            inst.marketStatus = effectiveState;

            // Update 1D simulated intraday candles
            const intradayCandleService = require('./IntradayCandleService');
            intradayCandleService.updateTick(inst);

            updated.push(inst);
        }

        if (updated.length > 0) {
            this.notifyListeners(updated);

            if (this.executionEngineCallback) {
                this.executionEngineCallback(this.getAllPricesMap());
            }
        }
    }

    updatePrice(symbol, newPrice) {
        const uppercaseSymbol = (symbol || '').toUpperCase().trim();
        const inst = this.getInstrument(uppercaseSymbol);
        if (!inst) return null;

        inst.lastPrice = roundMoney(newPrice);
        inst.high = Math.max(inst.high, inst.lastPrice);
        inst.low = Math.min(inst.low, inst.lastPrice);
        inst.change = roundMoney(inst.lastPrice - inst.previousClose);
        inst.changePercent = roundMoney(((inst.lastPrice - inst.previousClose) / inst.previousClose) * 100);
        inst.timestamp = Date.now();

        const intradayCandleService = require('./IntradayCandleService');
        intradayCandleService.updateTick(inst);

        this.notifyListeners([inst]);

        if (this.executionEngineCallback) {
            this.executionEngineCallback(this.getAllPricesMap());
        }

        return inst;
    }

    getInstrument(symbol) {
        if (!symbol) return null;
        const upper = decodeURIComponent(symbol).toUpperCase().trim();
        let inst = this.prices.get(upper);

        // Canonical alias fallbacks
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

    _formatSnapshot(raw) {
        const MarketCalendarService = require('../marketCalendarService');
        const realState = MarketCalendarService.getMarketState(new Date(), 'NSE');
        const forceOpen = process.env.MARKET_SIMULATION_FORCE_OPEN === 'true';
        const marketStatus = forceOpen ? 'OPEN' : realState;

        const lastPrice = roundMoney(raw.lastPrice || raw.referencePrice);
        const close = roundMoney(raw.close || raw.previousClose || lastPrice);
        return {
            symbol: raw.symbol,
            companyName: raw.companyName || raw.name,
            name: raw.companyName || raw.name,
            exchange: raw.exchange || 'NSE',
            instrumentType: raw.instrumentType || raw.type || 'EQUITY',
            type: raw.instrumentType || raw.type || 'EQUITY',
            sector: raw.sector || 'General',
            industry: raw.industry || 'General',
            isin: raw.isin || null,
            tickSize: raw.tickSize || 0.05,
            lotSize: raw.lotSize !== undefined ? raw.lotSize : 1,
            lastPrice,
            previousClose: close,
            close,
            open: roundMoney(raw.open || lastPrice),
            high: roundMoney(raw.high || lastPrice),
            low: roundMoney(raw.low || lastPrice),
            change: roundMoney(lastPrice - close),
            changePercent: close > 0 ? roundMoney(((lastPrice - close) / close) * 100) : 0,
            volume: (raw.instrumentType === 'INDEX' || raw.type === 'INDEX') ? 0 : (raw.volume || 100000),
            timestamp: Date.now(),
            marketStatus,
            momentum: 0,
            source: 'SIMULATION',
            mode: 'SIMULATION'
        };
    }
}

module.exports = SimulatedMarketDataProvider;
