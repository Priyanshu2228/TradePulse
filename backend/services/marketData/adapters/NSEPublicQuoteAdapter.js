const https = require('https');

const SYMBOL_TO_PUBLIC_KEY = {
    'RELIANCE': 'RELIANCE.NS',
    'TCS': 'TCS.NS',
    'INFY': 'INFY.NS',
    'HDFCBANK': 'HDFCBANK.NS',
    'ICICIBANK': 'ICICIBANK.NS',
    'BHARTIARTL': 'BHARTIARTL.NS',
    'SBIN': 'SBIN.NS',
    'LTIM': 'LTIM.NS',
    'ITC': 'ITC.NS',
    'HINDUNILVR': 'HINDUNILVR.NS',
    'LT': 'LT.NS',
    'BAJFINANCE': 'BAJFINANCE.NS',
    'AXISBANK': 'AXISBANK.NS',
    'KOTAKBANK': 'KOTAKBANK.NS',
    'MARUTI': 'MARUTI.NS',
    'SUNPHARMA': 'SUNPHARMA.NS',
    'TITAN': 'TITAN.NS',
    'ULTRACEMCO': 'ULTRACEMCO.NS',
    'ASIANPAINT': 'ASIANPAINT.NS',
    'TATASTEEL': 'TATASTEEL.NS',
    'NTPC': 'NTPC.NS',
    'POWERGRID': 'POWERGRID.NS',
    'M&M': 'M&M.NS',
    'TATAMOTORS': 'TATAMOTORS.NS',
    'ADANIENT': 'ADANIENT.NS',
    'ADANIPORTS': 'ADANIPORTS.NS',
    'COALINDIA': 'COALINDIA.NS',
    'ONGC': 'ONGC.NS',
    'BAJAJ-AUTO': 'BAJAJ-AUTO.NS',
    'HEROMOTOCO': 'HEROMOTOCO.NS',
    'EICHERMOT': 'EICHERMOT.NS',
    'WIPRO': 'WIPRO.NS',
    'HCLTECH': 'HCLTECH.NS',
    'TECHM': 'TECHM.NS',
    'JSWSTEEL': 'JSWSTEEL.NS',
    'HINDALCO': 'HINDALCO.NS',
    'BPCL': 'BPCL.NS',
    'GRASIM': 'GRASIM.NS',
    'CIPLA': 'CIPLA.NS',
    'DRREDDY': 'DRREDDY.NS',
    'DIVISLAB': 'DIVISLAB.NS',
    'APOLLOHOSP': 'APOLLOHOSP.NS',
    'TATACONSUM': 'TATACONSUM.NS',
    'BRITANNIA': 'BRITANNIA.NS',
    // Indices
    'NIFTY50': '^NSEI',
    'NIFTY 50': '^NSEI',
    'BANKNIFTY': '^NSEBANK',
    'BANK NIFTY': '^NSEBANK',
    'FINNIFTY': 'NIFTY_FIN_SERVICE.NS',
    'SENSEX': '^BSESN'
};

const PUBLIC_KEY_TO_SYMBOL = {};
for (const [sym, key] of Object.entries(SYMBOL_TO_PUBLIC_KEY)) {
    PUBLIC_KEY_TO_SYMBOL[key] = sym;
}

class NSEPublicQuoteAdapter {
    /**
     * DEVELOPMENT ONLY / NOT VERIFIED FOR PRODUCTION USE
     * 
     * Queries Yahoo Finance public quote endpoints (https://query1.finance.yahoo.com/v7/finance/quote).
     * This is an UNOFFICIAL, UNDOCUMENTED public endpoint used strictly for development and testing.
     * It does NOT require broker credentials or a Demat account, but is NOT an authorized exchange feed.
     */
    async fetchQuotes(symbols = []) {
        const publicKeys = symbols.map(s => SYMBOL_TO_PUBLIC_KEY[s.toUpperCase().trim()]).filter(Boolean);
        if (publicKeys.length === 0) return [];

        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(publicKeys.join(','))}`;

        return new Promise((resolve, reject) => {
            const req = https.request(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        const results = parsed.quoteResponse && parsed.quoteResponse.result ? parsed.quoteResponse.result : [];
                        
                        const quotes = results.map(q => {
                            const canonicalSymbol = PUBLIC_KEY_TO_SYMBOL[q.symbol] || q.symbol.replace('.NS', '').replace('.BO', '');
                            return {
                                symbol: canonicalSymbol,
                                ltp: q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice || 0,
                                open: q.regularMarketOpen || q.regularMarketPrice || 0,
                                high: q.regularMarketDayHigh || q.regularMarketPrice || 0,
                                low: q.regularMarketDayLow || q.regularMarketPrice || 0,
                                close: q.regularMarketPreviousClose || q.regularMarketPrice || 0,
                                previousClose: q.regularMarketPreviousClose || 0,
                                change: q.regularMarketChange || 0,
                                changePercent: q.regularMarketChangePercent || 0,
                                volume: q.regularMarketVolume || 0,
                                marketState: q.marketState || 'REGULAR',
                                timestamp: (q.regularMarketTime ? q.regularMarketTime * 1000 : Date.now())
                            };
                        });

                        resolve(quotes);
                    } catch (err) {
                        reject(new Error(`[NSEPublicQuoteAdapter] Failed to parse public quote response: ${err.message}`));
                    }
                });
            });

            req.on('error', (err) => reject(new Error(`[NSEPublicQuoteAdapter] Network request error: ${err.message}`)));
            req.end();
        });
    }
}

module.exports = {
    NSEPublicQuoteAdapter,
    SYMBOL_TO_PUBLIC_KEY
};
