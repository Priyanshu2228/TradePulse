/**
 * OHLCChart.js
 * Presentational component. Renders a candlestick chart and volume bar chart
 * using chart.js + chartjs-chart-financial.
 *
 * Props:
 *   candles  - array of { timestamp, open, high, low, close, volume }
 *   interval - '1D' | '1W' | '1M'
 *   symbol   - instrument symbol for aria labels
 *
 * Architecture:
 * - Two separate chart.js instances stacked via CSS (no custom sync logic)
 * - Both share the same computed labels[] and x-axis category entries
 * - Category x-axis avoids gaps on weekends/holidays — no interpolation
 * - useEffect cleanup destroys chart instances on unmount to prevent memory leaks
 * - All color choices match existing index.css .up/.down palette
 */
import React, { useEffect, useRef, useMemo } from 'react';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  CandlestickController,
  CandlestickElement,
} from 'chartjs-chart-financial';

// Register once at module level
Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  Tooltip,
  Legend,
  CandlestickController,
  CandlestickElement
);

// Color palette — matches index.css .up / .down
const COLOR_UP = '#4caf50';
const COLOR_DOWN = '#df514c';
const COLOR_UP_ALPHA = 'rgba(76, 175, 80, 0.15)';
const COLOR_DOWN_ALPHA = 'rgba(223, 81, 76, 0.15)';

/**
 * Format a candle timestamp for display.
 * All dates are expressed in IST (Asia/Kolkata).
 */
function formatDateIST(timestamp, interval) {
  const d = new Date(timestamp);
  const norm = (interval || '').toLowerCase();
  if (norm === '15m' || norm === '1m') {
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format price in Indian locale with ₹ prefix.
 */
function fmtPrice(v) {
  if (typeof v !== 'number') return '—';
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format volume in Indian locale (e.g. 1,23,456)
 */
function fmtVolume(v) {
  if (!v && v !== 0) return '—';
  return Number(v).toLocaleString('en-IN');
}

const OHLCChart = ({ candles, interval, symbol }) => {
  const priceCanvasRef = useRef(null);
  const volumeCanvasRef = useRef(null);
  const priceChartRef = useRef(null);
  const volumeChartRef = useRef(null);

  // Compute shared labels and datasets — memoized on candles change
  const { labels, priceData, volumeData, hasVolume } = useMemo(() => {
    if (!candles || candles.length === 0) {
      return { labels: [], priceData: [], volumeData: [], hasVolume: false };
    }

    const labs = candles.map((c) => formatDateIST(c.timestamp, interval));

    // candlestick dataset format: { x (label index), o, h, l, c }
    const pData = candles.map((c, idx) => ({
      x: idx,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
    }));

    const vData = candles.map((c, idx) => ({
      x: idx,
      y: c.volume || 0,
    }));

    // Volume panel is hidden if all volumes are 0 (typical for index instruments)
    const allZeroVolume = vData.every((v) => v.y === 0);

    return {
      labels: labs,
      priceData: pData,
      volumeData: vData,
      hasVolume: !allZeroVolume,
    };
  }, [candles, interval]);

  // Price (candlestick) chart
  useEffect(() => {
    if (!priceCanvasRef.current || !labels.length) return;

    // Destroy previous instance
    if (priceChartRef.current) {
      priceChartRef.current.destroy();
      priceChartRef.current = null;
    }

    const ctx = priceCanvasRef.current.getContext('2d');
    priceChartRef.current = new Chart(ctx, {
      type: 'candlestick',
      data: {
        labels,
        datasets: [
          {
            label: symbol,
            data: priceData,
            color: {
              up: COLOR_UP,
              down: COLOR_DOWN,
              unchanged: '#999',
            },
            borderColor: {
              up: COLOR_UP,
              down: COLOR_DOWN,
              unchanged: '#999',
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                if (!items.length) return '';
                const idx = items[0].dataIndex;
                return labels[idx] || '';
              },
              label: (item) => {
                const raw = item.raw;
                if (!raw) return '';
                return [
                  `O: ${fmtPrice(raw.o)}`,
                  `H: ${fmtPrice(raw.h)}`,
                  `L: ${fmtPrice(raw.l)}`,
                  `C: ${fmtPrice(raw.c)}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            type: 'category',
            ticks: {
              maxTicksLimit: 8,
              maxRotation: 0,
              font: { size: 11 },
              color: '#888',
            },
            grid: { color: '#f0f0f0' },
          },
          y: {
            position: 'right',
            ticks: {
              font: { size: 11 },
              color: '#888',
              callback: (v) => fmtPrice(v),
            },
            grid: { color: '#f0f0f0' },
          },
        },
      },
    });

    return () => {
      if (priceChartRef.current) {
        priceChartRef.current.destroy();
        priceChartRef.current = null;
      }
    };
  }, [labels, priceData, symbol]);

  // Volume (bar) chart
  useEffect(() => {
    if (!volumeCanvasRef.current || !labels.length || !hasVolume) return;

    if (volumeChartRef.current) {
      volumeChartRef.current.destroy();
      volumeChartRef.current = null;
    }

    const ctx = volumeCanvasRef.current.getContext('2d');

    // Color bars based on corresponding candle direction
    const barColors = candles.map((c) =>
      c.close >= c.open ? COLOR_UP_ALPHA : COLOR_DOWN_ALPHA
    );
    const borderColors = candles.map((c) =>
      c.close >= c.open ? COLOR_UP : COLOR_DOWN
    );

    volumeChartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Volume',
            data: volumeData,
            backgroundColor: barColors,
            borderColor: borderColors,
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                if (!items.length) return '';
                const idx = items[0].dataIndex;
                return labels[idx] || '';
              },
              label: (item) => `Vol: ${fmtVolume(item.raw?.y ?? item.raw)}`,
            },
          },
        },
        scales: {
          x: {
            type: 'category',
            ticks: {
              display: false, // x-axis shown on price chart only
            },
            grid: { color: '#f0f0f0' },
          },
          y: {
            position: 'right',
            ticks: {
              font: { size: 10 },
              color: '#aaa',
              maxTicksLimit: 3,
              callback: (v) => {
                if (v >= 1e7) return (v / 1e7).toFixed(1) + 'Cr';
                if (v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
                return v.toLocaleString('en-IN');
              },
            },
            grid: { color: '#f0f0f0' },
          },
        },
      },
    });

    return () => {
      if (volumeChartRef.current) {
        volumeChartRef.current.destroy();
        volumeChartRef.current = null;
      }
    };
  }, [labels, volumeData, hasVolume, candles]);

  if (!candles || candles.length === 0) {
    return (
      <div className="ohlc-chart__empty" id="ohlc-chart-empty-state">
        <p>No chart data available for this selection.</p>
      </div>
    );
  }

  return (
    <div className="ohlc-chart" id="ohlc-chart-container">
      <div className="ohlc-chart__price-panel">
        <canvas
          ref={priceCanvasRef}
          id="ohlc-price-canvas"
          aria-label={`${symbol} OHLC candlestick chart, ${interval} interval`}
          role="img"
        />
      </div>

      {hasVolume ? (
        <div className="ohlc-chart__volume-panel" id="ohlc-volume-panel">
          <canvas
            ref={volumeCanvasRef}
            id="ohlc-volume-canvas"
            aria-label={`${symbol} volume chart`}
            role="img"
          />
        </div>
      ) : (
        <div className="ohlc-chart__volume-hidden" id="ohlc-volume-hidden-note">
          Volume data not available for this instrument.
        </div>
      )}
    </div>
  );
};

export default OHLCChart;
