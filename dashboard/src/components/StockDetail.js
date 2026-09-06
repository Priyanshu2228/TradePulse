/**
 * StockDetail.js
 * Page component for the Stock Detail view.
 * Route: /stock/:symbol
 *
 * Owns all page-level state:
 *   - Instrument metadata (from /api/instruments/search)
 *   - Selected range and interval
 *   - Limit-warning state machine
 *
 * Delegates to:
 *   - useHistoricalData() — historical OHLC fetching
 *   - useWebSocket()      — live simulated price (from existing hook)
 *   - InstrumentHeader    — identity + simulated price display
 *   - TimeframeSelector  — range/interval buttons
 *   - LimitWarningBanner — warning when combination exceeds 1000 candles
 *   - OHLCChart          — candlestick + volume visualization
 *   - ChartDataBadge     — backend-driven historical provenance badge
 *
 * Data integrity rules:
 *   - Historical data is READ ONLY. Never modifies balances, holdings, orders.
 *   - Current price is from WebSocket simulation — always shown with SIMULATED PRICE badge.
 *   - No synthetic candles are ever generated or substituted for missing data.
 *   - API failures are surfaced explicitly — never silently replaced with fake data.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import useHistoricalData from '../hooks/useHistoricalData';
import InstrumentHeader from './InstrumentHeader';
import TimeframeSelector from './TimeframeSelector';
import LimitWarningBanner from './LimitWarningBanner';
import OHLCChart from './OHLCChart';
import ChartDataBadge from './ChartDataBadge';
import './StockDetail.css';

// ─── Limit-warning logic ────────────────────────────────────────────────────

/**
 * Conservative estimate of maximum trading candles for a given range.
 * Used for frontend pre-flight check only — backend is still authoritative.
 */
const MAX_CANDLES_BY_RANGE = {
  '5Y': 1260,   // ~252 trading days/year × 5
  'MAX': 1300,  // conservative upper bound
};

const CANDLES_PER_INTERVAL = {
  '1D': 1,
  '1W': 5,
  '1M': 22,
};

/**
 * Safe default interval per range — pre-selected when user clicks a range button.
 * These defaults avoid the 1000-candle limit without any warning.
 */
const DEFAULT_INTERVAL_FOR_RANGE = {
  '1H': '1m',
  '1D': '15m',
  '1W': '1D',
  '1M': '1D',
  '3M': '1D',
  '6M': '1D',
  '5Y': '1W',
  'MAX': '1M',
};

/**
 * Suggested safe alternative for a known exceeding combination.
 */
const SUGGESTED_INTERVAL = {
  '5Y:1D': '1W',
  'MAX:1D': '1W',
  'MAX:1W': '1M',
};

function estimateCandles(range, interval) {
  const maxCandles = MAX_CANDLES_BY_RANGE[range];
  if (!maxCandles) return 0; // Not a known problematic range
  const daysPerCandle = CANDLES_PER_INTERVAL[interval] || 1;
  return Math.ceil(maxCandles / daysPerCandle);
}

function willExceedLimit(range, interval) {
  const estimated = estimateCandles(range, interval);
  return estimated > 1000;
}

function getSuggestedInterval(range, interval) {
  return SUGGESTED_INTERVAL[`${range}:${interval}`] || DEFAULT_INTERVAL_FOR_RANGE[range];
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

const ChartSkeleton = () => (
  <div className="stock-detail__skeleton" id="chart-loading-skeleton" aria-label="Loading chart data">
    <div className="skeleton-bar skeleton-bar--tall" />
    <div className="skeleton-bar skeleton-bar--medium" />
    <div className="skeleton-bar skeleton-bar--short" />
    <div className="skeleton-bar skeleton-bar--medium" />
    <div className="skeleton-bar skeleton-bar--tall" />
    <div className="skeleton-bar skeleton-bar--medium" />
    <div className="skeleton-bar skeleton-bar--short" />
    <div className="skeleton-bar skeleton-bar--medium" />
  </div>
);

// ─── StockDetail page ─────────────────────────────────────────────────────────

const StockDetail = () => {
  const { symbol: rawSymbol } = useParams();
  const navigate = useNavigate();

  // Decode URL param — handles M%26M -> M&M
  const symbol = decodeURIComponent(rawSymbol || '');

  // ── Instrument metadata state ──
  const [instrument, setInstrument] = useState(null);
  const [instrumentLoading, setInstrumentLoading] = useState(true);
  const [instrumentError, setInstrumentError] = useState(null);

  // ── Timeframe state ──
  const [range, setRange] = useState('1D');
  const [interval, setInterval] = useState('15m');

  // ── Limit-warning state machine ──
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const [pendingInterval, setPendingInterval] = useState(null);

  // ── Live simulated price from WebSocket ──
  const { marketData } = useWebSocket();

  // Map canonical NIFTY50 to the WebSocket key "NIFTY 50"
  const wsKey = symbol === 'NIFTY50' ? 'NIFTY 50'
    : symbol === 'BANKNIFTY' ? 'BANKNIFTY'
    : symbol;
  const liveData = marketData[wsKey] || null;

  // ── Historical data ──
  const { data: candles, loading: histLoading, error: histError, isEmpty, sourceCode, count, refetch } =
    useHistoricalData({ symbol, range, interval });

  // ── Load instrument metadata ──
  useEffect(() => {
    if (!symbol) return;
    setInstrumentLoading(true);
    setInstrumentError(null);

    api.get('/instruments/search', { params: { q: symbol } })
      .then((res) => {
        const results = res.data || [];
        // Find exact symbol match, fall back to first result
        const match = results.find(
          (r) => (r.symbol || '').toUpperCase() === symbol.toUpperCase()
        ) || results[0];

        if (match) {
          setInstrument(match);
        } else {
          setInstrumentError('Instrument not found in the Instrument Master.');
        }
      })
      .catch(() => {
        setInstrumentError('Failed to load instrument details.');
      })
      .finally(() => {
        setInstrumentLoading(false);
      });
  }, [symbol]);

  // ── Range selection handler ──
  const handleRangeChange = useCallback((newRange) => {
    const safeInterval = DEFAULT_INTERVAL_FOR_RANGE[newRange] || '1D';

    if (willExceedLimit(newRange, interval)) {
      // Current interval would exceed limit with new range — warn
      setShowLimitWarning(true);
      setPendingInterval(interval);
      setRange(newRange);
      // Do NOT change interval yet — wait for user choice
    } else if (willExceedLimit(newRange, safeInterval)) {
      // Even the safe default exceeds — use safe default and warn
      setShowLimitWarning(true);
      setPendingInterval(safeInterval);
      setRange(newRange);
    } else {
      // Safe — apply the default interval for this range immediately
      setShowLimitWarning(false);
      setPendingInterval(null);
      setRange(newRange);
      setInterval(safeInterval);
    }
  }, [interval]);

  // ── Interval selection handler ──
  const handleIntervalChange = useCallback((newInterval) => {
    if (willExceedLimit(range, newInterval)) {
      // Show warning — do not fetch yet
      setShowLimitWarning(true);
      setPendingInterval(newInterval);
    } else {
      setShowLimitWarning(false);
      setPendingInterval(null);
      setInterval(newInterval);
    }
  }, [range]);

  // ── Limit-warning resolution: use suggested interval ──
  const handleUseSuggested = useCallback(() => {
    const suggested = getSuggestedInterval(range, pendingInterval || interval);
    setShowLimitWarning(false);
    setPendingInterval(null);
    setInterval(suggested);
  }, [range, pendingInterval, interval]);

  // ── Limit-warning resolution: continue with partial data ──
  const handleContinueAnyway = useCallback(() => {
    const chosen = pendingInterval || interval;
    setShowLimitWarning(false);
    setPendingInterval(null);
    setInterval(chosen);
  }, [pendingInterval, interval]);

  // ── Retry on network failure ──
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // ── Back navigation ──
  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // ── Estimated candle count for limit warning display ──
  const estimatedCandles = (showLimitWarning && pendingInterval)
    ? estimateCandles(range, pendingInterval)
    : 0;
  const suggestedForWarning = (showLimitWarning && pendingInterval)
    ? getSuggestedInterval(range, pendingInterval)
    : '';

  // ── Partial data note (user chose to continue anyway) ──
  const isPartialData = !showLimitWarning && count === 1000 && willExceedLimit(range, interval);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="stock-detail" id="stock-detail-page">

      {/* ── Instrument header ── */}
      {instrumentLoading ? (
        <div className="stock-detail__inst-loading">Loading instrument...</div>
      ) : instrumentError ? (
        <div className="stock-detail__inst-error" id="instrument-error-state">
          <p>{instrumentError}</p>
          <button onClick={handleBack} className="stock-detail__back-link">← Go back</button>
        </div>
      ) : (
        <InstrumentHeader
          instrument={instrument}
          liveData={liveData}
          onBack={handleBack}
        />
      )}

      {/* ── Timeframe selector ── */}
      <TimeframeSelector
        selectedRange={range}
        selectedInterval={interval}
        onRangeChange={handleRangeChange}
        onIntervalChange={handleIntervalChange}
      />

      {/* ── Limit warning banner ── */}
      {showLimitWarning && pendingInterval && (
        <LimitWarningBanner
          range={range}
          interval={pendingInterval}
          estimatedCandles={estimatedCandles}
          suggestedInterval={suggestedForWarning}
          onUseSuggested={handleUseSuggested}
          onContinueAnyway={handleContinueAnyway}
        />
      )}

      {/* ── Chart area ── */}
      <div className="stock-detail__chart-area" id="chart-area">

        {/* Loading state */}
        {histLoading && !showLimitWarning && <ChartSkeleton />}

        {/* Error states */}
        {!histLoading && histError && (
          <div className="stock-detail__error" id="chart-error-state">
            {histError.type === 'NOT_FOUND' && (
              <p>Instrument not found. Please check the symbol and try again.</p>
            )}
            {histError.type === 'UNSUPPORTED_INTERVAL' && (
              <p>This interval is not currently supported. Please select 1D, 1W, or 1M.</p>
            )}
            {histError.type === 'NETWORK' && (
              <>
                <p>Failed to load chart data. Please check your connection.</p>
                <button
                  id="chart-retry-btn"
                  className="stock-detail__retry-btn"
                  onClick={handleRetry}
                >
                  Try again
                </button>
              </>
            )}
            {histError.type === 'UNKNOWN' && (
              <>
                <p>{histError.message}</p>
                <button
                  id="chart-retry-btn"
                  className="stock-detail__retry-btn"
                  onClick={handleRetry}
                >
                  Try again
                </button>
              </>
            )}
          </div>
        )}

        {/* Empty state */}
        {!histLoading && !histError && isEmpty && (
          <div className="stock-detail__empty" id="chart-empty-state">
            <p>
              No historical data available for <strong>{symbol}</strong> in the selected range ({range} / {interval}).
            </p>
            <p style={{ fontSize: '13px', color: '#aaa', marginTop: '8px' }}>
              This may occur on weekends, market holidays, or if historical data has not been imported yet.
            </p>
          </div>
        )}

        {/* Chart */}
        {!histLoading && !histError && !isEmpty && !showLimitWarning && (
          <OHLCChart
            candles={candles}
            interval={interval}
            symbol={symbol}
          />
        )}

        {/* Partial data note */}
        {isPartialData && (
          <div className="stock-detail__partial-note" id="partial-data-note">
            Showing latest {count.toLocaleString('en-IN')} candles of {range} range — switch to{' '}
            <button
              className="stock-detail__inline-btn"
              onClick={() => handleIntervalChange(getSuggestedInterval(range, interval))}
            >
              {getSuggestedInterval(range, interval)}
            </button>{' '}
            interval for the complete range.
          </div>
        )}
      </div>

      {/* ── Chart footer: provenance + count ── */}
      {!histLoading && !histError && !isEmpty && !showLimitWarning && (
        <div className="stock-detail__footer" id="chart-footer">
          <ChartDataBadge sourceCode={sourceCode} interval={interval} />
          <span className="stock-detail__candle-count">
            {count.toLocaleString('en-IN')} candle{count !== 1 ? 's' : ''} · {interval} · {range}
          </span>
        </div>
      )}
    </div>
  );
};

export default StockDetail;
