const mongoose = require('mongoose');
const SimulatedMarketDataProvider = require('./SimulatedMarketDataProvider');
const HistoricalMarketDataProvider = require('./HistoricalMarketDataProvider');
const RealMarketDataProvider = require('./RealMarketDataProvider');
const { executionEngineInstance } = require('../executionEngine');

class MarketDataManager {
    constructor() {
        this.provider = null;
        this.mode = null;
    }

    getProvider() {
        if (!this.provider) {
            this.initProvider();
        }
        return this.provider;
    }

    initProvider(forcedMode) {
        const rawMode = forcedMode || process.env.MARKET_DATA_MODE || 'simulation';
        const normalizedMode = rawMode.toLowerCase().trim();

        if (normalizedMode === 'simulation') {
            this.provider = new SimulatedMarketDataProvider();
            this.mode = 'SIMULATION';
        } else if (normalizedMode === 'historical') {
            this.provider = new HistoricalMarketDataProvider();
            this.mode = 'HISTORICAL';
        } else if (normalizedMode === 'live') {
            this.provider = new RealMarketDataProvider();
            this.mode = 'LIVE';
        } else {
            throw new Error(`[MarketDataManager] Unsupported MARKET_DATA_MODE "${rawMode}". Supported modes are "simulation", "historical", and "live".`);
        }

        // Decoupled Event Listener: MarketDataManager connects price ticks to ExecutionEngine
        this.provider.on('tick', () => {
            if (mongoose.connection && mongoose.connection.readyState === 1) {
                const pricesMap = this.provider.getAllPricesMap();
                executionEngineInstance.processOpenOrders(pricesMap);
            }
        });

        console.log(`[MarketDataManager] Active market data provider initialized in ${this.mode} mode.`);
        return this.provider;
    }
}

const marketDataManagerInstance = new MarketDataManager();

module.exports = {
    marketDataManagerInstance,
    MarketDataManager
};
