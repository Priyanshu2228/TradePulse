/**
 * LimitWarningBanner.test.js
 * Tests for the 1000-candle limit warning component.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LimitWarningBanner from '../LimitWarningBanner';

describe('LimitWarningBanner', () => {
  const baseProps = {
    range: '5Y',
    interval: '1D',
    estimatedCandles: 1260,
    suggestedInterval: '1W',
    onUseSuggested: jest.fn(),
    onContinueAnyway: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders warning text with range and interval', () => {
    render(<LimitWarningBanner {...baseProps} />);
    expect(screen.getByText(/5Y \+ 1D would require approximately/i)).toBeInTheDocument();
  });

  test('renders estimated candle count', () => {
    render(<LimitWarningBanner {...baseProps} />);
    expect(screen.getByText(/1,260/)).toBeInTheDocument();
  });

  test('renders suggested interval in primary button', () => {
    render(<LimitWarningBanner {...baseProps} />);
    const btn = document.getElementById('limit-warning-use-suggested-btn');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain('1W');
  });

  test('renders continue-anyway button with chosen interval', () => {
    render(<LimitWarningBanner {...baseProps} />);
    const btn = document.getElementById('limit-warning-continue-btn');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain('1D');
  });

  test('clicking "Use suggested" calls onUseSuggested', () => {
    render(<LimitWarningBanner {...baseProps} />);
    fireEvent.click(document.getElementById('limit-warning-use-suggested-btn'));
    expect(baseProps.onUseSuggested).toHaveBeenCalledTimes(1);
  });

  test('clicking "Continue anyway" calls onContinueAnyway', () => {
    render(<LimitWarningBanner {...baseProps} />);
    fireEvent.click(document.getElementById('limit-warning-continue-btn'));
    expect(baseProps.onContinueAnyway).toHaveBeenCalledTimes(1);
  });

  test('renders correctly for MAX + 1D combination', () => {
    render(
      <LimitWarningBanner
        range="MAX"
        interval="1D"
        estimatedCandles={1300}
        suggestedInterval="1W"
        onUseSuggested={jest.fn()}
        onContinueAnyway={jest.fn()}
      />
    );
    expect(screen.getByText(/MAX \+ 1D would require approximately/i)).toBeInTheDocument();
    expect(screen.getByText(/1,300/)).toBeInTheDocument();
  });

  test('renders MAX + 1W combination with 1M suggestion', () => {
    render(
      <LimitWarningBanner
        range="MAX"
        interval="1W"
        estimatedCandles={1200}
        suggestedInterval="1M"
        onUseSuggested={jest.fn()}
        onContinueAnyway={jest.fn()}
      />
    );
    expect(screen.getByText(/MAX \+ 1W would require approximately/i)).toBeInTheDocument();
    const btn = document.getElementById('limit-warning-use-suggested-btn');
    expect(btn.textContent).toContain('1M');
  });
});
