const { getHistoricalOHLC } = require('../services/historicalDataService');

async function getHistoricalData(req, res) {
    try {
        const symbol = req.params.symbol;
        const options = {
            range: req.query.range,
            interval: req.query.interval,
            from: req.query.from,
            to: req.query.to,
            limit: req.query.limit
        };

        const result = await getHistoricalOHLC(symbol, options);
        res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        res.status(status).json({
            error: err.errorCode || 'HISTORICAL_QUERY_ERROR',
            message: err.message
        });
    }
}

module.exports = {
    getHistoricalData
};
