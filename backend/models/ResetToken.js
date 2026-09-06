const mongoose = require('mongoose');

const ResetTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: '15m' } // Automatic Mongoose TTL cleanup after 15 minutes
    },
    used: {
        type: Boolean,
        default: false,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const ResetTokenModel = mongoose.model('ResetToken', ResetTokenSchema);

module.exports = { ResetTokenSchema, ResetTokenModel };
