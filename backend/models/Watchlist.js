const mongoose = require('mongoose');

const WatchlistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    symbols: [{
        type: String,
        uppercase: true,
        trim: true
    }]
}, {
    timestamps: true
});

const WatchlistModel = mongoose.model('Watchlist', WatchlistSchema);

module.exports = { WatchlistSchema, WatchlistModel };
