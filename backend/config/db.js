const mongoose = require('mongoose');

let isReplicaSet = false;

async function connectDB() {
    const mongoUri = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/tradepulse';
    
    try {
        await mongoose.connect(mongoUri);
        console.log(`[TradePulse DB] Connected to MongoDB at ${mongoUri}`);

        // Inspect topology for replica set support
        try {
            const adminDb = mongoose.connection.db.admin();
            const status = await adminDb.command({ replSetGetStatus: 1 });
            if (status && status.ok) {
                isReplicaSet = true;
                console.log('[TradePulse DB] Replica set confirmed. Transactions enabled.');
            }
        } catch (err) {
            // Not running in replica set mode
            isReplicaSet = false;
            console.log('[TradePulse DB] Single node MongoDB detected.');
        }

        return mongoose.connection;
    } catch (err) {
        console.error('[TradePulse DB] Connection error:', err);
        throw err;
    }
}

function checkReplicaSet() {
    return isReplicaSet;
}

/**
 * Execute callback inside a MongoDB transaction session if supported,
 * or execute directly inside session context.
 */
async function withTransaction(callback) {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const result = await callback(session);
        await session.commitTransaction();
        return result;
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
}

module.exports = {
    connectDB,
    checkReplicaSet,
    withTransaction
};
