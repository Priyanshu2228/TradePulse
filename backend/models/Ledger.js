const mongoose = require('mongoose');

const LedgerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['INITIAL_DEPOSIT', 'BUY_RESERVATION', 'BUY_SETTLEMENT', 'SELL_PROCEEDS', 'CANCEL_RELEASE'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    referenceId: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const LedgerModel = mongoose.model('Ledger', LedgerSchema);

module.exports = { LedgerSchema, LedgerModel };
