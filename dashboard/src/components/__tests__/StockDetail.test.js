/**
 * StockDetail.test.js
 * Integration tests for the StockDetail page component.
 *
 * Strategy:
 * - OHLCChart is mocked to avoid jsdom canvas limitations
 * - Tests focus on StockDetail's state machine: loading, empty, error, limit warning
 * - API mocking via jest.mock on api.js using URL-based mockImplementation
 * - useWebSocket mocked to provide stable simulated price data
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock OHLCChart to avoid jsdom canvas/Chart.js limitations.
// StockDetail logic (state machine, badges, limit warning) is what we test here.
jest.mock('../OHLCChart', () => {
  const React = require('react');
  return function MockOHLCChart({ candles, symbol }) {
    return (
      <div data-testid="ohlc-chart" id="ohlc-chart-mock">
        MockChart:{symbol}:{candles ? candles.length : 0}
      </div>
    );
  };
});

// Mock api.js
jest.mock('../../services/api', () => ({
  get: jest.fn(),
}));

// Mock useWebSocket
jest.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    isConnected: true,
    marketData: {
      RELIANCE: { symbol: 'RELIANCE', lastPrice: 2112.40, changePercent: 1.44, previousClose: 2082.00 },
      'NIFTY 50': { symbol: 'NIFTY 50', lastPrice: 23540.50, changePercent: 0.32, previousClose: 23465.00 },
    },
  }),
}));

import StockDetail from '../StockDetail';
import api from '../../services/api';

// ── Test data ────────────────────────────────────────────────────────────────

const makeCandles = (count, source = 'YAHOO_FINANCE') =>
  Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(2024, 0, i + 1).toISOString(),
    open: 2100 + i,
    high: 2150 + i,
    low: 2080 + i,
    close: 2130 + i,
    volume: 500000 + i * 1000,
    source,
  }));

const relianceInstrument = [{
  symbol: 'RELIANCE',
  name: 'RELIANCE',
  companyName: 'Reliance Industries Ltd.',
  exchange: 'NSE',
  instrumentType: 'EQ',
  sector: 'Energy',
  lastPrice: 2100.00,
}];

const nifty50Instrument = [{
  symbol: 'NIFTY50',
  name: 'NIFTY 50',
  companyName: 'Nifty 50 Index',
  exchange: 'NSE',
  instrumentType: 'INDEX',
  sector: null,
  lastPrice: 23500.00,
}];

const mmInstrument = [{
  symbol: 'M&M',
  name: 'M&M',
  companyName: 'Mahindra & Mahindra Ltd.',
  exchange: 'NSE',
  instrumentType: 'EQ',
  sector: 'Automobile',
  lastPrice: 2980.00,
}];

// Render helper — places component at /stock/:symbol route
const renderAtSymbol = (symbol) => {
  return render(
    <MemoryRouter initialEntries={[`/stock/${encodeURIComponent(symbol)}`]}>
      <Routes>
        <Route path="/stock/:symbol" element={<StockDetail />} />
      </Routes>
    </MemoryRouter>
  );
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('StockDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Smart default mock based on endpoint URL
    api.get.mockImplementation((url, config) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/instruments/search')) {
        const q = (config?.params?.q || '').toUpperCase();
        if (q.includes('NIFTY')) return Promise.resolve({ data: nifty50Instrument });
        if (q.includes('M&M') || q.includes('M%26M')) return Promise.resolve({ data: mmInstrument });
        if (q.includes('UNKNOWN')) return Promise.resolve({ data: [] });
        return Promise.resolve({ data: relianceInstrument });
      }
      if (urlStr.includes('/historical/')) {
        return Promise.resolve({ data: { data: makeCandles(22, 'YAHOO_FINANCE'), count: 22 } });
      }
      return Promise.resolve({ data: [] });
    });
  });

  // ── Instrument metadata ──

  test('renders RELIANCE instrument header after load', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });

    await waitFor(() => expect(screen.getByText('RELIANCE')).toBeInTheDocument());
    expect(screen.getByText('Reliance Industries Ltd.')).toBeInTheDocument();
  });

  test('renders INDEX badge for NIFTY50', async () => {
    await act(async () => { renderAtSymbol('NIFTY50'); });

    await waitFor(() => expect(screen.getByText('INDEX')).toBeInTheDocument());
  });

  test('does not render INDEX badge for RELIANCE', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });

    await waitFor(() => expect(screen.getByText('RELIANCE')).toBeInTheDocument());
    expect(screen.queryByText('INDEX')).toBeNull();
  });

  // ── Provenance badges ──

  test('SIMULATED PRICE badge is always rendered', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });

    await waitFor(() =>
      expect(document.getElementById('simulated-price-badge')).toBeInTheDocument()
    );
  });

  test('PAPER TRADING badge is always rendered', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });

    await waitFor(() =>
      expect(document.getElementById('paper-trading-badge')).toBeInTheDocument()
    );
  });

  // ── Historical API calls ──

  test('fetches historical data with default 1D range and 15m interval on mount', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });

    await waitFor(() => {
      const histCall = api.get.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('/historical/')
      );
      expect(histCall).toBeTruthy();
      expect(histCall[1].params).toMatchObject({ range: '1D', interval: '15m' });
    });
  });

  // ── Special symbols ──

  test('handles M&M symbol correctly — encodes & in URL path', async () => {
    await act(async () => { renderAtSymbol('M&M'); });

    await waitFor(() => {
      const histCall = api.get.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('historical')
      );
      expect(histCall).toBeTruthy();
      expect(histCall[0]).toMatch(/M(%26|&)M/);
    });
  });

  // ── Loading state ──

  test('shows loading skeleton initially', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/instruments/search')) return Promise.resolve({ data: relianceInstrument });
      if (url.includes('/historical/')) return new Promise(() => {}); // never resolves
      return Promise.resolve({ data: [] });
    });

    renderAtSymbol('RELIANCE');

    await waitFor(() => {
      expect(document.getElementById('chart-loading-skeleton')).toBeInTheDocument();
    });
  });

  // ── Empty state ──

  test('shows empty state when API returns 0 candles', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/instruments/search')) return Promise.resolve({ data: relianceInstrument });
      if (url.includes('/historical/')) return Promise.resolve({ data: { data: [], count: 0 } });
      return Promise.resolve({ data: [] });
    });

    await act(async () => { renderAtSymbol('RELIANCE'); });

    await waitFor(() =>
      expect(document.getElementById('chart-empty-state')).toBeInTheDocument()
    );
  });

  // ── Error states ──

  test('shows instrument error when search returns empty array', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/instruments/search')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    await act(async () => { renderAtSymbol('UNKNOWN_XYZ'); });

    await waitFor(() =>
      expect(document.getElementById('instrument-error-state')).toBeInTheDocument()
    );
  });

  test('shows network error state with retry button for history fetch failure', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/instruments/search')) return Promise.resolve({ data: relianceInstrument });
      if (url.includes('/historical/')) return Promise.reject({ name: 'AxiosError', response: undefined, request: {} });
      return Promise.resolve({ data: [] });
    });

    await act(async () => { renderAtSymbol('RELIANCE'); });

    await waitFor(() =>
      expect(document.getElementById('chart-error-state')).toBeInTheDocument()
    );
    expect(document.getElementById('chart-retry-btn')).toBeInTheDocument();
  });

  // ── Limit warning ──

  test('5Y + 1D combination triggers LimitWarningBanner (not fetched yet)', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });
    await waitFor(() => expect(screen.getByText('RELIANCE')).toBeInTheDocument());

    await act(async () => { fireEvent.click(document.getElementById('range-btn-5Y')); });
    await act(async () => { fireEvent.click(document.getElementById('interval-btn-1D')); });

    expect(document.getElementById('limit-warning-banner')).toBeInTheDocument();
  });

  test('MAX + 1D triggers LimitWarningBanner', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });
    await waitFor(() => expect(screen.getByText('RELIANCE')).toBeInTheDocument());

    await act(async () => { fireEvent.click(document.getElementById('range-btn-MAX')); });
    await act(async () => { fireEvent.click(document.getElementById('interval-btn-1D')); });

    expect(document.getElementById('limit-warning-banner')).toBeInTheDocument();
  });

  test('"Use suggested interval" dismisses the warning', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });
    await waitFor(() => expect(screen.getByText('RELIANCE')).toBeInTheDocument());

    await act(async () => { fireEvent.click(document.getElementById('range-btn-5Y')); });
    await act(async () => { fireEvent.click(document.getElementById('interval-btn-1D')); });
    expect(document.getElementById('limit-warning-banner')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(document.getElementById('limit-warning-use-suggested-btn'));
    });

    await waitFor(() =>
      expect(document.getElementById('limit-warning-banner')).toBeNull()
    );
  });

  test('"Continue anyway" dismisses the warning', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });
    await waitFor(() => expect(screen.getByText('RELIANCE')).toBeInTheDocument());

    await act(async () => { fireEvent.click(document.getElementById('range-btn-5Y')); });
    await act(async () => { fireEvent.click(document.getElementById('interval-btn-1D')); });
    expect(document.getElementById('limit-warning-banner')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(document.getElementById('limit-warning-continue-btn'));
    });

    await waitFor(() =>
      expect(document.getElementById('limit-warning-banner')).toBeNull()
    );
  });

  // ── Provenance badge ──

  test('provenance badge shows "YAHOO FINANCE • EOD" for YAHOO_FINANCE source', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/instruments/search')) return Promise.resolve({ data: relianceInstrument });
      if (url.includes('/historical/')) return Promise.resolve({ data: { data: makeCandles(22, 'YAHOO_FINANCE'), count: 22 } });
      return Promise.resolve({ data: [] });
    });

    await act(async () => { renderAtSymbol('RELIANCE'); });

    await waitFor(() =>
      expect(screen.getByText('YAHOO FINANCE • EOD')).toBeInTheDocument()
    );
  });

  test('provenance badge shows "Synthetic (Test Data)" for SYNTHETIC source', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/instruments/search')) return Promise.resolve({ data: relianceInstrument });
      if (url.includes('/historical/')) return Promise.resolve({ data: { data: makeCandles(22, 'SYNTHETIC'), count: 22 } });
      return Promise.resolve({ data: [] });
    });

    await act(async () => { renderAtSymbol('RELIANCE'); });

    await waitFor(() =>
      expect(screen.getByText('Synthetic (Test Data)')).toBeInTheDocument()
    );
  });

  // ── Range switching ──

  test('clicking range button triggers additional API call', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });
    await waitFor(() => expect(screen.getByText('RELIANCE')).toBeInTheDocument());

    const callsBefore = api.get.mock.calls.length;

    await act(async () => {
      fireEvent.click(document.getElementById('range-btn-6M'));
    });

    await waitFor(() => {
      expect(api.get.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // ── Chart footer ──

  test('chart footer appears after successful data load', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });

    await waitFor(() =>
      expect(document.getElementById('chart-footer')).toBeInTheDocument()
    );
    expect(document.getElementById('chart-footer').textContent).toContain('22');
  });

  // ── Timeframe selector ──

  test('all 8 range buttons are rendered', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });

    ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'].forEach((r) => {
      expect(document.getElementById(`range-btn-${r}`)).toBeInTheDocument();
    });
  });

  test('interval button 15m is rendered for 1D simulated intraday range', async () => {
    await act(async () => { renderAtSymbol('RELIANCE'); });

    expect(document.getElementById('interval-btn-15m')).toBeInTheDocument();
    // Unsupported raw intraday intervals must NOT be present
    expect(document.getElementById('interval-btn-5M')).toBeNull();
    expect(document.getElementById('interval-btn-30M')).toBeNull();
    expect(document.getElementById('interval-btn-1H')).toBeNull();
  });
});
