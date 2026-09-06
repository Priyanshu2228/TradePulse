/**
 * InstrumentHeader.test.js
 * Tests for the instrument identity and simulated price header.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InstrumentHeader from '../InstrumentHeader';

const equityInstrument = {
  symbol: 'RELIANCE',
  companyName: 'Reliance Industries Ltd.',
  exchange: 'NSE',
  instrumentType: 'EQ',
  sector: 'Energy',
  lastPrice: 2100.00,
};

const indexInstrument = {
  symbol: 'NIFTY50',
  companyName: 'Nifty 50 Index',
  exchange: 'NSE',
  instrumentType: 'INDEX',
  sector: null,
  lastPrice: 23500.00,
};

const liveData = {
  lastPrice: 2112.40,
  changePercent: 1.44,
  previousClose: 2082.00,
};

describe('InstrumentHeader', () => {
  test('renders symbol and company name for equity', () => {
    render(<InstrumentHeader instrument={equityInstrument} liveData={null} onBack={() => {}} />);
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('Reliance Industries Ltd.')).toBeInTheDocument();
  });

  test('renders exchange badge', () => {
    render(<InstrumentHeader instrument={equityInstrument} liveData={null} onBack={() => {}} />);
    expect(screen.getByText('NSE')).toBeInTheDocument();
  });

  test('renders INDEX badge for index instruments', () => {
    render(<InstrumentHeader instrument={indexInstrument} liveData={null} onBack={() => {}} />);
    expect(screen.getByText('INDEX')).toBeInTheDocument();
  });

  test('does NOT render INDEX badge for equity instruments', () => {
    render(<InstrumentHeader instrument={equityInstrument} liveData={null} onBack={() => {}} />);
    expect(screen.queryByText('INDEX')).toBeNull();
  });

  test('SIMULATED PRICE badge is always shown — even with no live data', () => {
    render(<InstrumentHeader instrument={equityInstrument} liveData={null} onBack={() => {}} />);
    expect(screen.getByTestId ? screen.queryByText('SIMULATED PRICE') : document.getElementById('simulated-price-badge')).toBeTruthy();
  });

  test('SIMULATED PRICE badge ID is always present', () => {
    render(<InstrumentHeader instrument={equityInstrument} liveData={null} onBack={() => {}} />);
    expect(document.getElementById('simulated-price-badge')).toBeInTheDocument();
  });

  test('PAPER TRADING badge is always shown', () => {
    render(<InstrumentHeader instrument={equityInstrument} liveData={null} onBack={() => {}} />);
    expect(document.getElementById('paper-trading-badge')).toBeInTheDocument();
  });

  test('SIMULATED PRICE badge is shown even when live data is available', () => {
    render(<InstrumentHeader instrument={equityInstrument} liveData={liveData} onBack={() => {}} />);
    expect(document.getElementById('simulated-price-badge')).toBeInTheDocument();
  });

  test('shows live price when liveData is provided', () => {
    render(<InstrumentHeader instrument={equityInstrument} liveData={liveData} onBack={() => {}} />);
    // Should display formatted last price
    expect(screen.getByText(/2,112\.40/)).toBeInTheDocument();
  });

  test('shows "Simulated price not yet available" when no live data', () => {
    render(<InstrumentHeader instrument={equityInstrument} liveData={null} onBack={() => {}} />);
    expect(screen.getByText(/Simulated price not yet available/i)).toBeInTheDocument();
  });

  test('renders sector when provided', () => {
    render(<InstrumentHeader instrument={equityInstrument} liveData={null} onBack={() => {}} />);
    expect(screen.getByText('Energy')).toBeInTheDocument();
  });

  test('does not render sector when null', () => {
    render(<InstrumentHeader instrument={indexInstrument} liveData={null} onBack={() => {}} />);
    // No crash, no sector element rendered
    expect(document.querySelector('.instrument-header__sector')).toBeNull();
  });

  test('calls onBack when back button is clicked', () => {
    const onBack = jest.fn();
    render(<InstrumentHeader instrument={equityInstrument} liveData={null} onBack={onBack} />);
    fireEvent.click(document.getElementById('stock-detail-back-btn'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('renders nothing when instrument is null', () => {
    const { container } = render(<InstrumentHeader instrument={null} liveData={null} onBack={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  test('shows positive change in green color context', () => {
    render(<InstrumentHeader instrument={equityInstrument} liveData={liveData} onBack={() => {}} />);
    const change = document.querySelector('.instrument-header__change');
    expect(change).toBeInTheDocument();
    expect(change.style.color).toBe('rgb(76, 175, 80)'); // #4caf50
  });
});
