const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
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
        required: true,
        min: 1
    },
    filledQuantity: {
        type: Number,
        default: 0
    },
    orderType: {
        type: String,
        enum: ['MARKET', 'LIMIT'],
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    executionPrice: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['OPEN', 'FILLED', 'CANCELLED', 'REJECTED'],
        default: 'OPEN',
        index: true
    },
    reservedAmount: {
        type: Number,
        default: 0
    },
    reservedQuantity: {
        type: Number,
        default: 0
    },
    idempotencyKey: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Scoped idempotency index — unique key per user
OrderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });

const OrderModel = mongoose.model('Order', OrderSchema);

module.exports = { OrderSchema, OrderModel };
