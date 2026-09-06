/**
 * Verified Upstox Provider Instrument Mapper
 * 
 * Maps TradePulse canonical instruments ({ symbol, exchange })
 * to verified Upstox instrument keys (e.g. NSE_EQ|INE002A01018, NSE_INDEX|Nifty 50).
 * 
 * TradePulse canonical symbol identity remains strictly unchanged.
 */

// Verified Upstox Instrument Key Table
const VERIFIED_UPSTOX_KEYS = {
    'RELIANCE': 'NSE_EQ|INE002A01018',
    'TCS': 'NSE_EQ|INE467B01029',
    'INFY': 'NSE_EQ|INE009A01021',
    'HDFCBANK': 'NSE_EQ|INE040A01034',
    'ICICIBANK': 'NSE_EQ|INE090A01021',
    'BHARTIARTL': 'NSE_EQ|INE397D01024',
    'SBIN': 'NSE_EQ|INE062A01020',
    'LTIM': 'NSE_EQ|INE214T01019',
    'ITC': 'NSE_EQ|INE154A01025',
    'HINDUNILVR': 'NSE_EQ|INE030A01027',
    'LT': 'NSE_EQ|INE018A01030',
    'BAJFINANCE': 'NSE_EQ|INE296A01024',
    'AXISBANK': 'NSE_EQ|INE238A01034',
    'KOTAKBANK': 'NSE_EQ|INE237A01028',
    'MARUTI': 'NSE_EQ|INE585B01010',
    'SUNPHARMA': 'NSE_EQ|INE044A01036',
    'TITAN': 'NSE_EQ|INE280A01028',
    'ULTRACEMCO': 'NSE_EQ|INE481G01011',
    'ASIANPAINT': 'NSE_EQ|INE021A01026',
    'TATASTEEL': 'NSE_EQ|INE081A01020',
    'NTPC': 'NSE_EQ|INE733E01010',
    'POWERGRID': 'NSE_EQ|INE752E01010',
    'M&M': 'NSE_EQ|INE101A01026',
    'TATAMOTORS': 'NSE_EQ|INE155A01022',
    'ADANIENT': 'NSE_EQ|INE423A01024',
    'ADANIPORTS': 'NSE_EQ|INE742H01013',
    'COALINDIA': 'NSE_EQ|INE522F01014',
    'ONGC': 'NSE_EQ|INE213A01029',
    'BAJAJ-AUTO': 'NSE_EQ|INE917I01010',
    'HEROMOTOCO': 'NSE_EQ|INE158A01026',
    'EICHERMOT': 'NSE_EQ|INE066A01021',
    'WIPRO': 'NSE_EQ|INE075A01022',
    'HCLTECH': 'NSE_EQ|INE860A01027',
    'TECHM': 'NSE_EQ|INE669C01036',
    'JSWSTEEL': 'NSE_EQ|INE019A01038',
    'HINDALCO': 'NSE_EQ|INE038A01020',
    'BPCL': 'NSE_EQ|INE029A01011',
    'GRASIM': 'NSE_EQ|INE047A01021',
    'CIPLA': 'NSE_EQ|INE059A01026',
    'DRREDDY': 'NSE_EQ|INE089A01023',
    'DIVISLAB': 'NSE_EQ|INE361B01024',
    'APOLLOHOSP': 'NSE_EQ|INE437A01024',
    'TATACONSUM': 'NSE_EQ|INE192A01025',
    'BRITANNIA': 'NSE_EQ|INE216A01030',
    // Indices
    'NIFTY50': 'NSE_INDEX|Nifty 50',
    'BANKNIFTY': 'NSE_INDEX|Nifty Bank',
    'FINNIFTY': 'NSE_INDEX|Nifty Fin Service',
    'SENSEX': 'BSE_INDEX|SENSEX'
};

// Reverse map for fast lookup
const REVERSE_UPSTOX_KEYS = {};
for (const [symbol, key] of Object.entries(VERIFIED_UPSTOX_KEYS)) {
    REVERSE_UPSTOX_KEYS[key] = symbol;
}

class ProviderInstrumentMapper {
    /**
     * Resolves verified Upstox instrument key for a canonical TradePulse symbol.
     */
    static getProviderKey(symbol) {
        if (!symbol) return null;
        const upper = symbol.toUpperCase().trim();
        // Canonical alias normalizations
        if (upper === 'NIFTY 50') return VERIFIED_UPSTOX_KEYS['NIFTY50'];
        if (upper === 'BANK NIFTY') return VERIFIED_UPSTOX_KEYS['BANKNIFTY'];
        
        return VERIFIED_UPSTOX_KEYS[upper] || null;
    }

    /**
     * Resolves canonical TradePulse symbol for an Upstox instrument key.
     */
    static getCanonicalSymbol(providerKey) {
        if (!providerKey) return null;
        return REVERSE_UPSTOX_KEYS[providerKey] || null;
    }

    /**
     * Returns list of verified provider keys for an array of canonical instruments.
     */
    static getProviderKeysForInstruments(instruments = []) {
        const keys = [];
        for (const inst of instruments) {
            const sym = typeof inst === 'string' ? inst : inst.symbol;
            const key = this.getProviderKey(sym);
            if (key) {
                keys.push(key);
            }
        }
        return keys;
    }
}

module.exports = {
    ProviderInstrumentMapper,
    VERIFIED_UPSTOX_KEYS
};
