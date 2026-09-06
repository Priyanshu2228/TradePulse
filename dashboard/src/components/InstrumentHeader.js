/**
 * InstrumentHeader.js
 * Presentational component. Shows instrument identity and current simulated price.
 *
 * Props:
 *   instrument - from /api/instruments/search: { symbol, companyName, exchange,
 *                instrumentType, sector, lastPrice }
 *   liveData   - from useWebSocket(): { lastPrice, changePercent, previousClose }
 *                May be undefined if the symbol is not yet in the WebSocket feed.
 *   onBack     - () => void — called when the back button is clicked
 *
 * IMPORTANT: The current price is ALWAYS from the TradePulse simulation WebSocket.
 * It is NOT a live NSE/BSE price.
 * The SIMULATED PRICE badge must be shown at all times regardless of data availability.
 */
import React from 'react';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

const InstrumentHeader = ({ instrument, liveData, onBack, isFav, onToggleFav }) => {
  const { symbol, companyName, exchange, instrumentType, sector } = instrument || {};

  if (!instrument) return null;

  // Live simulated price — from WebSocket feed only
  const lastPrice = liveData?.lastPrice ?? null;
  const changePercent = liveData?.changePercent ?? null;
  const previousClose = liveData?.previousClose ?? instrument.lastPrice ?? null;
  const absoluteChange = (lastPrice !== null && previousClose !== null)
    ? lastPrice - previousClose
    : null;

  const isUp = changePercent !== null ? changePercent >= 0 : null;
  const priceColor = isUp === null ? '#666' : (isUp ? '#4caf50' : '#df514c');
  const changeSign = isUp ? '+' : '';

  const fmtPrice = (v) =>
    typeof v === 'number'
      ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '—';

  const fmtChange = (abs, pct) => {
    if (abs === null || pct === null) return null;
    return `${changeSign}${fmtPrice(abs)} (${changeSign}${pct.toFixed(2)}%)`;
  };

  return (
    <div className="instrument-header">
      <div className="instrument-header__top">
        <button
          id="stock-detail-back-btn"
          className="instrument-header__back-btn"
          onClick={onBack}
          aria-label="Go back"
        >
          ← Back
        </button>

        <div className="instrument-header__identity">
          <div className="instrument-header__symbol-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="instrument-header__symbol">{symbol}</span>
            {onToggleFav && (
              <button
                id="header-fav-btn"
                onClick={onToggleFav}
                title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  color: isFav ? '#0284c7' : '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {isFav ? <StarIcon style={{ fontSize: '22px' }} /> : <StarBorderIcon style={{ fontSize: '22px' }} />}
              </button>
            )}
            <span className="instrument-header__badge instrument-header__badge--exchange">
              {exchange}
            </span>
            {instrumentType === 'INDEX' && (
              <span className="instrument-header__badge instrument-header__badge--index">
                INDEX
              </span>
            )}
          </div>
          <div className="instrument-header__company">{companyName}</div>
          {sector && (
            <div className="instrument-header__sector">{sector}</div>
          )}
        </div>
      </div>

      <div className="instrument-header__price-row">
        <div className="instrument-header__price-group">
          {lastPrice !== null ? (
            <>
              <span className="instrument-header__price">
                ₹{fmtPrice(lastPrice)}
              </span>
              <span
                className="instrument-header__change"
                style={{ color: priceColor }}
              >
                {fmtChange(absoluteChange, changePercent)}
              </span>
            </>
          ) : (
            <span className="instrument-header__price-unavailable">
              Simulated price not yet available
            </span>
          )}
        </div>

        <div className="instrument-header__badges">
          {/* Dynamic Feed Badge — reflects LIVE vs SIMULATION vs STALE vs MARKET CLOSED */}
          {liveData?.mode === 'LIVE' || liveData?.source === 'LIVE' ? (
            liveData?.isStale ? (
              <span
                id="simulated-price-badge"
                className="instrument-header__badge instrument-header__badge--stale"
                title="Live market feed tick is stale (>10s)"
              >
                LIVE (STALE)
              </span>
            ) : liveData?.marketStatus === 'MARKET_CLOSED' ? (
              <span
                id="simulated-price-badge"
                className="instrument-header__badge instrument-header__badge--closed"
                title="Indian market is currently closed. Showing last known traded price."
              >
                LIVE (MARKET CLOSED)
              </span>
            ) : (
              <span
                id="simulated-price-badge"
                className="instrument-header__badge instrument-header__badge--live"
                title="Real-time price feed from authorized Upstox V3 Market Feed"
              >
                LIVE MARKET DATA
              </span>
            )
          ) : (
            <span
              id="simulated-price-badge"
              className="instrument-header__badge instrument-header__badge--simulated"
              title="Price from TradePulse paper trading simulation"
            >
              SIMULATED PRICE
            </span>
          )}
          <span
            id="paper-trading-badge"
            className="instrument-header__badge instrument-header__badge--paper"
            title="This is a paper trading account using virtual funds"
          >
            PAPER TRADING
          </span>
        </div>
      </div>
    </div>
  );
};

export default InstrumentHeader;
