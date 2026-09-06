function errorHandler(err, req, res, next) {
    console.error('[TradePulse Error]', err);

    const statusCode = res.statusCode === 200 ? (err.statusCode || 500) : res.statusCode;

    // Handle Mongo duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || {})[0] || 'field';
        return res.status(409).json({
            message: `Duplicate request or record already exists (${field})`,
            field
        });
    }

    res.status(statusCode).json({
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
}

module.exports = { errorHandler };
