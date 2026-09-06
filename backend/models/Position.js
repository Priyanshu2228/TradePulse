const mongoose = require('mongoose');

const PositionSchema = new mongoose.Schema({
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
    buyQuantity: {
        type: Number,
        default: 0
    },
    sellQuantity: {
        type: Number,
        default: 0
    },
    buyValue: {
        type: Number,
        default: 0
    },
    sellValue: {
        type: Number,
        default: 0
    },
    realizedPnL: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

PositionSchema.index({ userId: 1, instrumentSymbol: 1 }, { unique: true });

PositionSchema.virtual('netQuantity').get(function () {
    return this.buyQuantity - this.sellQuantity;
});

const PositionModel = mongoose.model('Position', PositionSchema);

module.exports = { PositionSchema, PositionModel };
