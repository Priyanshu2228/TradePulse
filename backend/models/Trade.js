const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    instrumentSymbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    side: {
        type: String,
        enum: ['BUY', 'SELL'],
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    value: {
        type: Number,
        required: true
    },
    charges: {
        type: Number,
        default: 0.00
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const TradeModel = mongoose.model('Trade', TradeSchema);

module.exports = { TradeSchema, TradeModel };
