const mongoose = require('mongoose');

const OHLCContainerSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        index: true
    },
    exchange: {
        type: String,
        enum: ['NSE', 'BSE'],
        default: 'NSE'
    },
    interval: {
        type: String,
        enum: ['1D', '1W', '1M'],
        default: '1D',
        index: true
    },
    timestamp: {
        type: Date,
        required: true,
        index: true
    },
    open: {
        type: Number,
        required: true
    },
    high: {
        type: Number,
        required: true
    },
    low: {
        type: Number,
        required: true
    },
    close: {
        type: Number,
        required: true
    },
    volume: {
        type: Number,
        default: 0
    },
    source: {
        type: String,
        default: 'YAHOO_FINANCE'
    }
}, {
    timestamps: false
});

// Compound Unique Index: prevents duplicate candles for the same symbol, interval & timestamp
OHLCContainerSchema.index({ symbol: 1, interval: 1, timestamp: 1 }, { unique: true });

// Efficient Range Query Index: optimized for range filtering and timestamp sorting
OHLCContainerSchema.index({ symbol: 1, interval: 1, timestamp: -1 });

const OHLCModel = mongoose.model('OHLC', OHLCContainerSchema);

module.exports = { OHLCContainerSchema, OHLCModel };
