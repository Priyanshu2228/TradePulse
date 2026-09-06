const MarketDataProvider = require('./MarketDataProvider');
const { getHistoricalOHLC } = require('../historicalDataService');
const { InstrumentModel } = require('../../models/Instrument');

class HistoricalMarketDataProvider extends MarketDataProvider {
    constructor() {
        super();
        this.prices = new Map();
    }

    getMode() {
        return 'HISTORICAL';
    }

    async init() {
        const instruments = await InstrumentModel.find({});
        for (const inst of instruments) {
            this.prices.set(inst.symbol, {
                symbol: inst.symbol,
                companyName: inst.companyName,
                exchange: inst.exchange,
                instrumentType: inst.instrumentType,
                lastPrice: inst.referencePrice,
                close: inst.referencePrice,
                timestamp: Date.now(),
                source: 'HISTORICAL_DATABASE',
                mode: 'HISTORICAL'
            });
        }
        console.log(`[HistoricalMarketDataProvider] Initialized historical provider with ${this.prices.size} instruments.`);
    }

    async fetchHistoricalOHLC(symbol, options = {}) {
        return await getHistoricalOHLC(symbol, options);
    }

    start() {
        console.log('[HistoricalMarketDataProvider] Historical data mode active (read-only historical queries).');
    }

    stop() {
        console.log('[HistoricalMarketDataProvider] Historical provider stopped.');
    }

    getInstrument(symbol) {
        return this.prices.get((symbol || '').toUpperCase().trim());
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
        throw new Error('[HistoricalMarketDataProvider] Cannot modify real historical data prices dynamically.');
    }
}

module.exports = HistoricalMarketDataProvider;
