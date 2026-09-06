const mongoose = require('mongoose');

const InstrumentSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    companyName: {
        type: String,
        required: true,
        trim: true
    },
    exchange: {
        type: String,
        enum: ['NSE', 'BSE'],
        default: 'NSE'
    },
    instrumentType: {
        type: String,
        enum: ['EQUITY', 'INDEX'],
        default: 'EQUITY'
    },
    sector: {
        type: String,
        default: 'General',
        trim: true
    },
    industry: {
        type: String,
        default: 'General',
        trim: true
    },
    isin: {
        type: String,
        default: null,
        trim: true
    },
    tickSize: {
        type: Number,
        default: 0.05
    },
    lotSize: {
        type: Number,
        default: 1
    },
    tradingStatus: {
        type: String,
        enum: ['ACTIVE', 'HALTED', 'SUSPENDED'],
        default: 'ACTIVE'
    },
    referencePrice: {
        type: Number,
        required: true,
        default: 100.00
    },
    searchableAliases: [{
        type: String,
        uppercase: true,
        trim: true
    }],
    
    // Legacy fallback fields for backward compatibility with raw DB queries
    lastPrice: { type: Number, default: 0 },
    open: { type: Number, default: 0 },
    high: { type: Number, default: 0 },
    low: { type: Number, default: 0 },
    close: { type: Number, default: 0 },
    volume: { type: Number, default: 0 }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound unique index for identity
InstrumentSchema.index({ symbol: 1, exchange: 1 }, { unique: true });

// Virtual getters for backward compatibility with existing legacy code
InstrumentSchema.virtual('name')
    .get(function () { return this.companyName; })
    .set(function (val) { this.companyName = val; });

InstrumentSchema.virtual('type')
    .get(function () { return this.instrumentType; })
    .set(function (val) { this.instrumentType = val; });

const InstrumentModel = mongoose.model('Instrument', InstrumentSchema);

module.exports = { InstrumentSchema, InstrumentModel };
