const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
    },
    otpHash: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['EMAIL_VERIFICATION', 'LOGIN_OTP', 'PASSWORD_RESET'],
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: '10m' } // Mongoose TTL auto-cleanup after 10 minutes
    },
    attempts: {
        type: Number,
        default: 0
    },
    used: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const OtpModel = mongoose.model('Otp', OtpSchema);

module.exports = { OtpSchema, OtpModel };
