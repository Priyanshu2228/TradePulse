const mongoose = require('mongoose');

const HoldingSchema = new mongoose.Schema({
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
    quantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    blockedQuantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    avgPrice: {
        type: Number,
        required: true,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

HoldingSchema.index({ userId: 1, instrumentSymbol: 1 }, { unique: true });

HoldingSchema.virtual('sellableQuantity').get(function () {
    return Math.max(0, this.quantity - this.blockedQuantity);
});

const HoldingModel = mongoose.model('Holding', HoldingSchema);

module.exports = { HoldingSchema, HoldingModel };
