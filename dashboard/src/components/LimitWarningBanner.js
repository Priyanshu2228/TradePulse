/**
 * LimitWarningBanner.js
 * Presentational component. Shown when a user-selected range+interval
 * combination is estimated to exceed the API's 1000-candle hard limit.
 *
 * Per approved spec: do NOT silently truncate or silently change interval.
 * Present a clear warning with two explicit choices.
 *
 * Props:
 *   range             - user's selected range e.g. '5Y'
 *   interval          - user's selected (pending) interval e.g. '1D'
 *   estimatedCandles  - number, conservative estimate of candles required
 *   suggestedInterval - the safe alternative interval e.g. '1W'
 *   onUseSuggested    - () => void — use the safe suggestedInterval instead
 *   onContinueAnyway  - () => void — proceed with the exceeding combination (partial data)
 */
import React from 'react';

const LimitWarningBanner = ({
  range,
  interval,
  estimatedCandles,
  suggestedInterval,
  onUseSuggested,
  onContinueAnyway,
}) => {
  return (
    <div className="limit-warning" role="alert" id="limit-warning-banner">
      <div className="limit-warning__icon">⚠</div>
      <div className="limit-warning__body">
        <p className="limit-warning__title">
          {range} + {interval} would require approximately {estimatedCandles.toLocaleString('en-IN')} candles.
          The API limit is 1,000.
        </p>
        <p className="limit-warning__detail">
          Continuing with {interval} will show only the <strong>latest 1,000 trading days</strong> of the {range} range — not the complete period.
        </p>
        <div className="limit-warning__actions">
          <button
            id="limit-warning-use-suggested-btn"
            className="limit-warning__btn limit-warning__btn--primary"
            onClick={onUseSuggested}
          >
            Use {suggestedInterval} instead (full {range} range)
          </button>
          <button
            id="limit-warning-continue-btn"
            className="limit-warning__btn limit-warning__btn--secondary"
            onClick={onContinueAnyway}
          >
            Continue with {interval} (partial — latest 1,000 days only)
          </button>
        </div>
      </div>
    </div>
  );
};

export default LimitWarningBanner;
