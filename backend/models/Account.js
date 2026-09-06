const mongoose = require('mongoose');
const { roundMoney } = require('../utils/moneyUtils');

const AccountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    totalBalance: {
        type: Number,
        required: true,
        default: 100000.00,
        get: v => roundMoney(v),
        set: v => roundMoney(v)
    },
    blockedBalance: {
        type: Number,
        required: true,
        default: 0.00,
        get: v => roundMoney(v),
        set: v => roundMoney(v)
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true }
});

// Derived property — source of truth invariant: availableBalance = totalBalance - blockedBalance
AccountSchema.virtual('availableBalance').get(function () {
    return roundMoney(this.totalBalance - this.blockedBalance);
});

const AccountModel = mongoose.model('Account', AccountSchema);

module.exports = { AccountSchema, AccountModel };
