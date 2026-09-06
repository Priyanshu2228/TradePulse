/**
 * TrueData Instrument Mapper
 * 
 * Maps TradePulse canonical instruments (e.g., RELIANCE, NIFTY50, SENSEX)
 * to TrueData specific symbol formatting (e.g., RELIANCE-EQ, NIFTY 50, SENSEX).
 * 
 * TrueData Standard Naming:
 * - NSE Equities: <SYMBOL>-EQ (e.g. RELIANCE-EQ, INFY-EQ)
 * - NSE Indices: NIFTY 50, NIFTY BANK, NIFTY FINANCIAL SERVICE
 * - BSE Indices: SENSEX
 */

const CANONICAL_TO_TRUEDATA = {
    'RELIANCE': 'RELIANCE-EQ',
    'TCS': 'TCS-EQ',
    'INFY': 'INFY-EQ',
    'HDFCBANK': 'HDFCBANK-EQ',
    'ICICIBANK': 'ICICIBANK-EQ',
    'BHARTIARTL': 'BHARTIARTL-EQ',
    'SBIN': 'SBIN-EQ',
    'LTIM': 'LTIM-EQ',
    'ITC': 'ITC-EQ',
    'HINDUNILVR': 'HINDUNILVR-EQ',
    'LT': 'LT-EQ',
    'BAJFINANCE': 'BAJFINANCE-EQ',
    'AXISBANK': 'AXISBANK-EQ',
    'KOTAKBANK': 'KOTAKBANK-EQ',
    'MARUTI': 'MARUTI-EQ',
    'SUNPHARMA': 'SUNPHARMA-EQ',
    'TITAN': 'TITAN-EQ',
    'ULTRACEMCO': 'ULTRACEMCO-EQ',
    'ASIANPAINT': 'ASIANPAINT-EQ',
    'TATASTEEL': 'TATASTEEL-EQ',
    'NTPC': 'NTPC-EQ',
    'POWERGRID': 'POWERGRID-EQ',
    'M&M': 'M&M-EQ',
    'TATAMOTORS': 'TATAMOTORS-EQ',
    'ADANIENT': 'ADANIENT-EQ',
    'ADANIPORTS': 'ADANIPORTS-EQ',
    'COALINDIA': 'COALINDIA-EQ',
    'ONGC': 'ONGC-EQ',
    'BAJAJ-AUTO': 'BAJAJ-AUTO-EQ',
    'HEROMOTOCO': 'HEROMOTOCO-EQ',
    'EICHERMOT': 'EICHERMOT-EQ',
    'WIPRO': 'WIPRO-EQ',
    'HCLTECH': 'HCLTECH-EQ',
    'TECHM': 'TECHM-EQ',
    'JSWSTEEL': 'JSWSTEEL-EQ',
    'HINDALCO': 'HINDALCO-EQ',
    'BPCL': 'BPCL-EQ',
    'GRASIM': 'GRASIM-EQ',
    'CIPLA': 'CIPLA-EQ',
    'DRREDDY': 'DRREDDY-EQ',
    'DIVISLAB': 'DIVISLAB-EQ',
    'APOLLOHOSP': 'APOLLOHOSP-EQ',
    'TATACONSUM': 'TATACONSUM-EQ',
    'BRITANNIA': 'BRITANNIA-EQ',
    // Indices
    'NIFTY50': 'NIFTY 50',
    'NIFTY 50': 'NIFTY 50',
    'BANKNIFTY': 'NIFTY BANK',
    'BANK NIFTY': 'NIFTY BANK',
    'FINNIFTY': 'NIFTY FINANCIAL SERVICE',
    'SENSEX': 'SENSEX'
};

const TRUEDATA_TO_CANONICAL = {
    'NIFTY 50': 'NIFTY50',
    'NIFTY BANK': 'BANKNIFTY',
    'NIFTY FINANCIAL SERVICE': 'FINNIFTY',
    'SENSEX': 'SENSEX'
};
for (const [canonical, truedataSymbol] of Object.entries(CANONICAL_TO_TRUEDATA)) {
    if (!TRUEDATA_TO_CANONICAL[truedataSymbol]) {
        TRUEDATA_TO_CANONICAL[truedataSymbol] = canonical;
    }
}

class TrueDataInstrumentMapper {
    /**
     * Map TradePulse symbol to TrueData symbol
     */
    static toTrueDataSymbol(symbol) {
        if (!symbol) return null;
        const upper = symbol.toUpperCase().trim();
        return CANONICAL_TO_TRUEDATA[upper] || `${upper}-EQ`;
    }

    /**
     * Map TrueData symbol to TradePulse canonical symbol
     */
    static toCanonicalSymbol(truedataSymbol) {
        if (!truedataSymbol) return null;
        const clean = truedataSymbol.trim();
        if (TRUEDATA_TO_CANONICAL[clean]) {
            return TRUEDATA_TO_CANONICAL[clean];
        }
        return clean.replace(/-EQ$/, '');
    }
}

module.exports = {
    TrueDataInstrumentMapper,
    CANONICAL_TO_TRUEDATA,
    TRUEDATA_TO_CANONICAL
};
