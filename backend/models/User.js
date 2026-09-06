const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verifiedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const UserModel = mongoose.model('User', UserSchema);

module.exports = { UserSchema, UserModel };
