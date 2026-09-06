/**
 * TimeframeSelector.js
 * Presentational component. Renders range and interval button groups.
 *
 * Props:
 *   selectedRange    - currently active range string e.g. '1H', '1D', '1M'
 *   selectedInterval - currently active interval string e.g. '15m', '1m', '1D'
 *   onRangeChange    - (range: string) => void
 *   onIntervalChange - (interval: string) => void
 */
import React from 'react';

const RANGES = ['1H', '1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];

const TimeframeSelector = ({
  selectedRange,
  selectedInterval,
  onRangeChange,
  onIntervalChange,
}) => {
  const intervals = selectedRange === '1H' ? ['1m'] : selectedRange === '1D' ? ['1m', '15m'] : ['1D', '1W', '1M'];
  const intervalLabels = {
    '1m': '1m (1 min simulated intraday)',
    '15m': '15m (15 min simulated intraday)',
    '1D': '1D (daily)',
    '1W': '1W (weekly)',
    '1M': '1M (monthly)',
  };

  return (
    <div className="timeframe-selector">
      <div className="timeframe-selector__ranges" role="group" aria-label="Select time range">
        {RANGES.map((r) => (
          <button
            key={r}
            id={`range-btn-${r}`}
            className={`timeframe-btn ${selectedRange === r ? 'timeframe-btn--active' : ''}`}
            onClick={() => onRangeChange(r)}
            aria-pressed={selectedRange === r}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="timeframe-selector__intervals" role="group" aria-label="Select candle interval">
        <span className="timeframe-selector__label">Interval:</span>
        {intervals.map((i) => (
          <button
            key={i}
            id={`interval-btn-${i}`}
            className={`timeframe-btn timeframe-btn--interval ${selectedInterval === i ? 'timeframe-btn--active' : ''}`}
            onClick={() => onIntervalChange(i)}
            aria-pressed={selectedInterval === i}
            title={intervalLabels[i]}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimeframeSelector;
