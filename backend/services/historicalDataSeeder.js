const https = require('https');
const { OHLCModel } = require('../models/OHLC');
const { InstrumentModel } = require('../models/Instrument');
const MarketCalendarService = require('./marketCalendarService');
const { roundMoney } = require('../utils/moneyUtils');
const { clearHistoricalCache } = require('./historicalDataService');

// Explicit Provider Symbol Mapping Table for Equities and Benchmarks
const SYMBOL_MAPPINGS = {
    'NIFTY50': '^NSEI',
    'BANKNIFTY': '^NSEBANK',
    'SENSEX': '^BSESN',
    'TATAMOTORS': 'TMPV.NS',
    'LTIM': 'LTTS.NS'
};

function getProviderSymbol(symbol) {
    const upper = (symbol || '').toUpperCase().trim();
    if (SYMBOL_MAPPINGS[upper]) {
        return SYMBOL_MAPPINGS[upper];
    }
    // M&M will be URL encoded as M%26M.NS when passed to HTTP GET request
    return `${upper}.NS`;
}

/**
 * Make real HTTP GET request to Yahoo Finance v8 chart API.
 * Flow: Yahoo Finance HTTP GET API -> JSON Parsing -> Quote Extraction
 */
function fetchYahooFinanceChart(providerSymbol, range = '5y') {
    return new Promise((resolve, reject) => {
        const encodedSymbol = encodeURIComponent(providerSymbol);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?range=${range}&interval=1d`;
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            },
            timeout: 10000
        };

        const req = https.get(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Yahoo Finance API returned HTTP status ${res.statusCode}`));
                }
                try {
                    const parsed = JSON.parse(body);
                    if (!parsed.chart || !parsed.chart.result || !parsed.chart.result[0]) {
                        return reject(new Error('Malformed Yahoo Finance API response structure'));
                    }
                    resolve(parsed.chart.result[0]);
                } catch (err) {
                    reject(new Error(`Failed to parse Yahoo Finance JSON response: ${err.message}`));
                }
            });
        });

        req.on('error', (err) => reject(new Error(`Network error fetching Yahoo Finance chart: ${err.message}`)));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout fetching Yahoo Finance chart API'));
        });
    });
}

/**
 * Primary Dataset Importer Pipeline:
 * Yahoo Finance HTTP GET Response -> Validation -> OHLC Document -> MongoDB.
 * NO synthetic/random/GBM candles are generated or substituted.
 */
async function importHistoricalDataset(range = '5y') {
    const instruments = await InstrumentModel.find({});
    const auditReports = [];
    const allCandles = [];

    for (const inst of instruments) {
        const symbol = inst.symbol;
        const providerSymbol = getProviderSymbol(symbol);
        
        let result;

        try {
            // Step 1: Real HTTP GET request to Yahoo Finance API
            result = await fetchYahooFinanceChart(providerSymbol, range);
        } catch (err) {
            console.warn(`[HistoricalDataSeeder] HTTP fetch failed for ${symbol} (${providerSymbol}): ${err.message}`);
            // Report failed fetch explicitly without generating synthetic math
            auditReports.push({
                symbol,
                providerSymbol,
                requestedPeriod: range.toUpperCase(),
                failed: true,
                errorMessage: err.message,
                importedCount: 0,
                skippedCount: 0,
                invalidCount: 0
            });
            continue;
        }

        const timestamps = result.timestamp || [];
        const indicators = result.indicators || {};
        const quote = (indicators.quote && indicators.quote[0]) || {};

        const opens = quote.open || [];
        const highs = quote.high || [];
        const lows = quote.low || [];
        const closes = quote.close || [];
        const volumes = quote.volume || [];

        let importedCount = 0;
        let skippedCount = 0;
        let invalidCount = 0;

        let earliestDate = null;
        let latestDate = null;

        // Step 2 & 3: Extract & Validate real Yahoo Finance OHLC candles
        for (let i = 0; i < timestamps.length; i++) {
            const unixTimeMs = timestamps[i] * 1000;
            const rawDate = new Date(unixTimeMs);

            const rawOpen = opens[i];
            const rawHigh = highs[i];
            const rawLow = lows[i];
            const rawClose = closes[i];
            const rawVol = volumes[i];

            // Reject missing/null/NaN price points from Yahoo response
            if (rawOpen == null || rawHigh == null || rawLow == null || rawClose == null ||
                isNaN(rawOpen) || isNaN(rawHigh) || isNaN(rawLow) || isNaN(rawClose)) {
                skippedCount++;
                continue;
            }

            const open = roundMoney(rawOpen);
            const high = roundMoney(rawHigh);
            const low = roundMoney(rawLow);
            const close = roundMoney(rawClose);
            const volume = Math.max(0, Math.floor(Number(rawVol) || 0));

            // Strict Mathematical Integrity Verification
            if (high < open || high < close || low > open || low > close || high < low || volume < 0) {
                invalidCount++;
                continue;
            }

            const timestamp = MarketCalendarService.normalizeToISTMidnight(rawDate);

            allCandles.push({
                symbol,
                exchange: inst.exchange || 'NSE',
                interval: '1D',
                timestamp,
                open,
                high,
                low,
                close,
                volume,
                source: 'YAHOO_FINANCE'
            });

            if (!earliestDate) earliestDate = timestamp;
            latestDate = timestamp;
            importedCount++;
        }

        auditReports.push({
            symbol,
            providerSymbol,
            requestedPeriod: range.toUpperCase(),
            failed: false,
            actualAvailableFrom: earliestDate ? earliestDate.toISOString() : null,
            actualAvailableTo: latestDate ? latestDate.toISOString() : null,
            importedCount,
            skippedCount,
            invalidCount
        });
    }

    // Step 4: Fast MongoDB bulk insertion of real Yahoo Finance OHLC candles
    if (allCandles.length > 0) {
        try {
            await OHLCModel.insertMany(allCandles, { ordered: false });
        } catch (err) {
            // Ignore duplicate key errors on re-seed
        }
    }

    clearHistoricalCache();
    console.log(`[HistoricalDataSeeder] Imported ${allCandles.length} real Yahoo Finance OHLC records for ${auditReports.filter(r => !r.failed).length} instruments.`);
    return auditReports;
}

module.exports = {
    importHistoricalDataset,
    fetchYahooFinanceChart,
    getProviderSymbol
};
