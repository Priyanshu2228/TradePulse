const { InstrumentModel } = require('../models/Instrument');

const SEED_UNIVERSE = [
    // IT Sector
    { symbol: 'TCS', companyName: 'Tata Consultancy Services Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'IT', industry: 'IT Services', referencePrice: 3194.80, searchableAliases: ['TATA CONSULTANCY'] },
    { symbol: 'INFY', companyName: 'Infosys Limited', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'IT', industry: 'IT Services', referencePrice: 1555.45, searchableAliases: ['INFOSYS'] },
    { symbol: 'WIPRO', companyName: 'Wipro Limited', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'IT', industry: 'IT Services', referencePrice: 577.75, searchableAliases: ['WIPRO'] },
    { symbol: 'HCLTECH', companyName: 'HCL Technologies Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'IT', industry: 'IT Services', referencePrice: 1120.00, searchableAliases: ['HCL'] },
    { symbol: 'TECHM', companyName: 'Tech Mahindra Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'IT', industry: 'IT Services', referencePrice: 1050.00, searchableAliases: ['MAHINDRA TECH'] },
    { symbol: 'LTIM', companyName: 'LTIMindtree Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'IT', industry: 'IT Services', referencePrice: 4750.00, searchableAliases: ['MINDTREE', 'LTI'] },

    // Banking Sector
    { symbol: 'HDFCBANK', companyName: 'HDFC Bank Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Banking', industry: 'Private Bank', referencePrice: 1522.35, searchableAliases: ['HDFC'] },
    { symbol: 'ICICIBANK', companyName: 'ICICI Bank Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Banking', industry: 'Private Bank', referencePrice: 945.50, searchableAliases: ['ICICI'] },
    { symbol: 'SBIN', companyName: 'State Bank of India', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Banking', industry: 'Public Bank', referencePrice: 575.20, searchableAliases: ['SBI', 'STATE BANK'] },
    { symbol: 'AXISBANK', companyName: 'Axis Bank Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Banking', industry: 'Private Bank', referencePrice: 860.00, searchableAliases: ['AXIS'] },
    { symbol: 'KOTAKBANK', companyName: 'Kotak Mahindra Bank Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Banking', industry: 'Private Bank', referencePrice: 1720.00, searchableAliases: ['KOTAK'] },
    { symbol: 'INDUSINDBK', companyName: 'IndusInd Bank Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Banking', industry: 'Private Bank', referencePrice: 1150.00, searchableAliases: ['INDUSIND'] },

    // Financial Services
    { symbol: 'BAJFINANCE', companyName: 'Bajaj Finance Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Financial Services', industry: 'NBFC', referencePrice: 6500.00, searchableAliases: ['BAJAJ FINANCE'] },
    { symbol: 'BAJAJFINSV', companyName: 'Bajaj Finserv Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Financial Services', industry: 'Holding Company', referencePrice: 1520.00, searchableAliases: ['BAJAJ FINSERV'] },
    { symbol: 'CHOLAFIN', companyName: 'Cholamandalam Investment and Finance Co.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Financial Services', industry: 'NBFC', referencePrice: 1080.00, searchableAliases: ['CHOLA'] },

    // Automobile
    { symbol: 'TATAMOTORS', companyName: 'Tata Motors Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Automobile', industry: 'Auto Manufacturers', referencePrice: 480.00, searchableAliases: ['TATA MOTORS'] },
    { symbol: 'MARUTI', companyName: 'Maruti Suzuki India Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Automobile', industry: 'Auto Manufacturers', referencePrice: 8700.00, searchableAliases: ['MARUTI SUZUKI'] },
    { symbol: 'M&M', companyName: 'Mahindra & Mahindra Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Automobile', industry: 'Auto Manufacturers', referencePrice: 779.80, searchableAliases: ['MM', 'MAHINDRA'] },
    { symbol: 'HEROMOTOCO', companyName: 'Hero MotoCorp Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Automobile', industry: 'Two Wheelers', referencePrice: 2750.00, searchableAliases: ['HERO'] },
    { symbol: 'EICHERMOT', companyName: 'Eicher Motors Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Automobile', industry: 'Two Wheelers', referencePrice: 3200.00, searchableAliases: ['EICHER', 'ROYAL ENFIELD'] },

    // Energy & Power
    { symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Energy', industry: 'Oil & Gas Conglomerate', referencePrice: 2112.40, searchableAliases: ['RIL', 'RELIANCE INDUSTRIES'] },
    { symbol: 'ONGC', companyName: 'Oil & Natural Gas Corp Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Energy', industry: 'Oil Exploration', referencePrice: 155.00, searchableAliases: ['OIL AND NATURAL GAS'] },
    { symbol: 'NTPC', companyName: 'NTPC Limited', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Energy', industry: 'Power Generation', referencePrice: 175.00, searchableAliases: ['NATIONAL THERMAL POWER'] },
    { symbol: 'POWERGRID', companyName: 'Power Grid Corp of India Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Energy', industry: 'Power Transmission', referencePrice: 210.00, searchableAliases: ['POWER GRID'] },
    { symbol: 'BPCL', companyName: 'Bharat Petroleum Corp Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Energy', industry: 'Oil Refining', referencePrice: 330.00, searchableAliases: ['BHARAT PETROLEUM'] },
    { symbol: 'TATAPOWER', companyName: 'Tata Power Co. Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Energy', industry: 'Power Generation', referencePrice: 124.15, searchableAliases: ['TATA POWER'] },

    // Pharma & Healthcare
    { symbol: 'SUNPHARMA', companyName: 'Sun Pharmaceutical Industries Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Pharma', industry: 'Pharmaceuticals', referencePrice: 980.00, searchableAliases: ['SUN PHARMA'] },
    { symbol: 'DRREDDY', companyName: 'Dr. Reddy\'s Laboratories Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Pharma', industry: 'Pharmaceuticals', referencePrice: 4400.00, searchableAliases: ['DR REDDY'] },
    { symbol: 'CIPLA', companyName: 'Cipla Limited', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Pharma', industry: 'Pharmaceuticals', referencePrice: 1020.00, searchableAliases: ['CIPLA'] },
    { symbol: 'DIVISLAB', companyName: 'Divi\'s Laboratories Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Pharma', industry: 'Pharmaceuticals', referencePrice: 3400.00, searchableAliases: ['DIVIS LAB'] },

    // FMCG
    { symbol: 'ITC', companyName: 'ITC Limited', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'FMCG', industry: 'Consumer Goods', referencePrice: 207.90, searchableAliases: ['ITC'] },
    { symbol: 'HINDUNILVR', companyName: 'Hindustan Unilever Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'FMCG', industry: 'Consumer Goods', referencePrice: 2500.00, searchableAliases: ['HUL', 'HINDUSTAN UNILEVER'] },
    { symbol: 'NESTLEIND', companyName: 'Nestle India Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'FMCG', industry: 'Food & Beverages', referencePrice: 2200.00, searchableAliases: ['NESTLE'] },
    { symbol: 'BRITANNIA', companyName: 'Britannia Industries Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'FMCG', industry: 'Food & Beverages', referencePrice: 4300.00, searchableAliases: ['BRITANNIA'] },
    { symbol: 'TATACONSUM', companyName: 'Tata Consumer Products Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'FMCG', industry: 'Consumer Goods', referencePrice: 760.00, searchableAliases: ['TATA CONSUMER'] },

    // Telecom
    { symbol: 'BHARTIARTL', companyName: 'Bharti Airtel Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Telecom', industry: 'Telecom Services', referencePrice: 541.15, searchableAliases: ['AIRTEL', 'BHARTI AIRTEL'] },

    // Metals
    { symbol: 'TATASTEEL', companyName: 'Tata Steel Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Metals', industry: 'Steel', referencePrice: 110.50, searchableAliases: ['TATA STEEL'] },
    { symbol: 'JSWSTEEL', companyName: 'JSW Steel Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Metals', industry: 'Steel', referencePrice: 720.00, searchableAliases: ['JSW STEEL'] },
    { symbol: 'HINDALCO', companyName: 'Hindalco Industries Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Metals', industry: 'Aluminum & Copper', referencePrice: 430.00, searchableAliases: ['HINDALCO'] },

    // Infrastructure & Cement
    { symbol: 'LT', companyName: 'Larsen & Toubro Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Infrastructure', industry: 'Engineering & Construction', referencePrice: 2150.00, searchableAliases: ['LARSEN AND TOUBRO', 'LNT'] },
    { symbol: 'ULTRACEMCO', companyName: 'UltraTech Cement Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Infrastructure', industry: 'Cement', referencePrice: 7400.00, searchableAliases: ['ULTRATECH'] },

    // Conglomerates
    { symbol: 'ADANIENT', companyName: 'Adani Enterprises Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Technology', industry: 'Trading Conglomerate', referencePrice: 1850.00, searchableAliases: ['ADANI ENTERPRISES'] },
    { symbol: 'ADANIPORTS', companyName: 'Adani Ports & SEZ Ltd.', exchange: 'NSE', instrumentType: 'EQUITY', sector: 'Infrastructure', industry: 'Ports & Logistics', referencePrice: 680.00, searchableAliases: ['ADANI PORTS'] },

    // Canonical Indices
    { symbol: 'NIFTY50', companyName: 'Nifty 50 Index Benchmark', exchange: 'NSE', instrumentType: 'INDEX', sector: 'Index', industry: 'Index Benchmark', referencePrice: 22450.80, lotSize: 0, searchableAliases: ['NIFTY 50', 'NIFTY'] },
    { symbol: 'BANKNIFTY', companyName: 'Nifty Bank Index Benchmark', exchange: 'NSE', instrumentType: 'INDEX', sector: 'Index', industry: 'Index Benchmark', referencePrice: 47800.00, lotSize: 0, searchableAliases: ['BANK NIFTY', 'NIFTY BANK'] },
    { symbol: 'SENSEX', companyName: 'BSE Sensex Index Benchmark', exchange: 'BSE', instrumentType: 'INDEX', sector: 'Index', industry: 'Index Benchmark', referencePrice: 73800.50, lotSize: 0, searchableAliases: ['BSE SENSEX', 'SENSEX 30'] }
];

async function seedInstruments() {
    try {
        await InstrumentModel.syncIndexes();
    } catch (err) {
        console.warn('[InstrumentSeedService] syncIndexes warning:', err.message);
    }

    await InstrumentModel.updateMany(
        { symbol: 'SENSEX', exchange: 'NSE' },
        { $set: { exchange: 'BSE', instrumentType: 'INDEX' } }
    );

    await InstrumentModel.deleteMany({ symbol: 'NIFTY 50' });

    const ops = SEED_UNIVERSE.map(inst => ({
        updateOne: {
            filter: { symbol: inst.symbol, exchange: inst.exchange },
            update: {
                $set: {
                    symbol: inst.symbol,
                    companyName: inst.companyName,
                    exchange: inst.exchange,
                    instrumentType: inst.instrumentType,
                    sector: inst.sector,
                    industry: inst.industry || 'General',
                    isin: inst.isin || null,
                    tickSize: inst.tickSize || 0.05,
                    lotSize: inst.lotSize !== undefined ? inst.lotSize : 1,
                    tradingStatus: 'ACTIVE',
                    referencePrice: inst.referencePrice,
                    searchableAliases: inst.searchableAliases || [],
                    // Legacy fallback fields for DB queries
                    lastPrice: inst.referencePrice,
                    open: inst.referencePrice,
                    high: inst.referencePrice,
                    low: inst.referencePrice,
                    close: inst.referencePrice,
                    volume: inst.instrumentType === 'INDEX' ? 0 : 100000
                }
            },
            upsert: true
        }
    }));

    const result = await InstrumentModel.bulkWrite(ops);
    console.log(`[InstrumentSeedService] Seeded ${SEED_UNIVERSE.length} Indian equity & index instruments (Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}).`);

    // Auto-seed real Yahoo Finance OHLC historical dataset if database is unseeded
    if (process.env.NODE_ENV !== 'test') {
        const { OHLCModel } = require('../models/OHLC');
        const { importHistoricalDataset } = require('./historicalDataSeeder');
        const ohlcCount = await OHLCModel.countDocuments();
        if (ohlcCount === 0) {
            console.log('[InstrumentSeedService] OHLC database is unseeded. Auto-importing 5Y Yahoo Finance EOD dataset...');
            await importHistoricalDataset('5y');
        }
    }

    return SEED_UNIVERSE.length;
}

module.exports = {
    seedInstruments,
    SEED_UNIVERSE
};
