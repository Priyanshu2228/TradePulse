/**
 * ChartDataBadge.js
 * Presentational component. Displays data provenance label driven
 * by backend source field and interval.
 */
import React from 'react';

const ChartDataBadge = ({ sourceCode, interval }) => {
  if (!sourceCode) return null;

  let label = sourceCode;

  if (sourceCode === 'SIMULATION' || sourceCode === 'SIMULATED') {
    if ((interval || '').toLowerCase() === '1m') {
      label = 'SIMULATED • 1 MIN';
    } else {
      label = 'SIMULATED • 15 MIN';
    }
  } else if (sourceCode === 'YAHOO_FINANCE') {
    label = 'YAHOO FINANCE • EOD';
  } else if (sourceCode === 'SYNTHETIC') {
    label = 'Synthetic (Test Data)';
  }

  return (
    <span className="chart-data-badge" title={`Data source: ${label}`}>
      <span className="chart-data-badge__dot" />
      {label}
    </span>
  );
};

export default ChartDataBadge;
