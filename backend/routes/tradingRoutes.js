const express = require('express');
const asyncHandler = require('express-async-handler');
const {
    getInstruments,
    searchInstruments,
    getWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    reorderWatchlist,
    handlePlaceOrder,
    handleCancelOrder,
    getOrders,
    getTrades,
    getHoldings,
    getPositions,
    getFunds,
    getSummary,
    getAnalytics
} = require('../controllers/tradingController');
const { getHistoricalData } = require('../controllers/historicalController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/instruments', asyncHandler(getInstruments));
router.get('/instruments/search', asyncHandler(searchInstruments));
router.get('/historical/:symbol', asyncHandler(getHistoricalData));

router.get('/watchlist', authenticateToken, asyncHandler(getWatchlist));
router.post('/watchlist/add', authenticateToken, asyncHandler(addToWatchlist));
router.post('/watchlist/remove', authenticateToken, asyncHandler(removeFromWatchlist));
router.post('/watchlist/reorder', authenticateToken, asyncHandler(reorderWatchlist));

router.post('/orders', authenticateToken, asyncHandler(handlePlaceOrder));
router.delete('/orders/:id', authenticateToken, asyncHandler(handleCancelOrder));
router.get('/orders', authenticateToken, asyncHandler(getOrders));

router.get('/trades', authenticateToken, asyncHandler(getTrades));
router.get('/holdings', authenticateToken, asyncHandler(getHoldings));
router.get('/positions', authenticateToken, asyncHandler(getPositions));
router.get('/funds', authenticateToken, asyncHandler(getFunds));
router.get('/summary', authenticateToken, asyncHandler(getSummary));
router.get('/analytics', authenticateToken, asyncHandler(getAnalytics));

module.exports = router;
