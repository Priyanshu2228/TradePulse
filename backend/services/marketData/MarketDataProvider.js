const EventEmitter = require('events');

class MarketDataProvider extends EventEmitter {
    constructor() {
        super();
        if (this.constructor === MarketDataProvider) {
            throw new Error('MarketDataProvider is an abstract base class and cannot be instantiated directly.');
        }
    }

    async init() {
        throw new Error('Method "init()" must be implemented by subclass.');
    }

    start(intervalMs = 2000) {
        throw new Error('Method "start()" must be implemented by subclass.');
    }

    stop() {
        throw new Error('Method "stop()" must be implemented by subclass.');
    }

    getInstrument(symbol) {
        throw new Error('Method "getInstrument()" must be implemented by subclass.');
    }

    getAllInstruments() {
        throw new Error('Method "getAllInstruments()" must be implemented by subclass.');
    }

    getAllPricesMap() {
        throw new Error('Method "getAllPricesMap()" must be implemented by subclass.');
    }

    updatePrice(symbol, newPrice) {
        throw new Error('Method "updatePrice()" must be implemented by subclass.');
    }

    getMode() {
        throw new Error('Method "getMode()" must be implemented by subclass.');
    }

    // Pub/Sub listener helpers for WebSockets / application layer
    subscribe(listener) {
        this.on('tick', listener);
        return () => this.off('tick', listener);
    }

    notifyListeners(data) {
        this.emit('tick', data);
    }
}

module.exports = MarketDataProvider;
