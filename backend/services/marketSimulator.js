const { marketDataManagerInstance } = require('./marketData/MarketDataManager');

// Re-export provider instance from MarketDataManager for 100% backward compatibility
const simulatorInstance = marketDataManagerInstance.getProvider();

module.exports = {
    simulatorInstance,
    MarketSimulator: simulatorInstance.constructor
};
