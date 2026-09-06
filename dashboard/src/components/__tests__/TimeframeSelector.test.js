/**
 * TimeframeSelector.test.js
 * Tests for the range and interval button group.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TimeframeSelector from '../TimeframeSelector';

const noop = () => {};

describe('TimeframeSelector', () => {
  const RANGES = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];
  const INTERVALS = ['1D', '1W', '1M'];

  test('renders all 8 range buttons', () => {
    render(
      <TimeframeSelector
        selectedRange="1M"
        selectedInterval="1D"
        onRangeChange={noop}
        onIntervalChange={noop}
      />
    );
    // Use IDs to check each range button exists specifically
    RANGES.forEach((r) => {
      expect(document.getElementById(`range-btn-${r}`)).toBeInTheDocument();
    });
  });

  test('renders exactly 3 interval buttons (1D, 1W, 1M — no intraday)', () => {
    render(
      <TimeframeSelector
        selectedRange="1M"
        selectedInterval="1D"
        onRangeChange={noop}
        onIntervalChange={noop}
      />
    );
    INTERVALS.forEach((i) => {
      // There may be multiple elements with text "1D" (range button + interval button)
      // Verify each interval button exists by ID
      expect(document.getElementById(`interval-btn-${i}`)).toBeInTheDocument();
    });
    // Verify intraday intervals are NOT rendered
    expect(document.getElementById('interval-btn-5M')).toBeNull();
    expect(document.getElementById('interval-btn-15M')).toBeNull();
    expect(document.getElementById('interval-btn-30M')).toBeNull();
    expect(document.getElementById('interval-btn-1H')).toBeNull();
  });

  test('active range button has --active class', () => {
    render(
      <TimeframeSelector
        selectedRange="3M"
        selectedInterval="1D"
        onRangeChange={noop}
        onIntervalChange={noop}
      />
    );
    const btn = document.getElementById('range-btn-3M');
    expect(btn.className).toContain('timeframe-btn--active');
  });

  test('non-active range buttons do not have --active class', () => {
    render(
      <TimeframeSelector
        selectedRange="3M"
        selectedInterval="1D"
        onRangeChange={noop}
        onIntervalChange={noop}
      />
    );
    ['1D', '1W', '1M', '6M', '1Y', '5Y', 'MAX'].forEach((r) => {
      const btn = document.getElementById(`range-btn-${r}`);
      expect(btn.className).not.toContain('timeframe-btn--active');
    });
  });

  test('active interval button has --active class', () => {
    render(
      <TimeframeSelector
        selectedRange="1M"
        selectedInterval="1W"
        onRangeChange={noop}
        onIntervalChange={noop}
      />
    );
    const btn = document.getElementById('interval-btn-1W');
    expect(btn.className).toContain('timeframe-btn--active');
  });

  test('clicking range button calls onRangeChange with correct value', () => {
    const onChange = jest.fn();
    render(
      <TimeframeSelector
        selectedRange="1M"
        selectedInterval="1D"
        onRangeChange={onChange}
        onIntervalChange={noop}
      />
    );
    fireEvent.click(document.getElementById('range-btn-6M'));
    expect(onChange).toHaveBeenCalledWith('6M');
  });

  test('clicking interval button calls onIntervalChange with correct value', () => {
    const onChange = jest.fn();
    render(
      <TimeframeSelector
        selectedRange="1M"
        selectedInterval="1D"
        onRangeChange={noop}
        onIntervalChange={onChange}
      />
    );
    fireEvent.click(document.getElementById('interval-btn-1W'));
    expect(onChange).toHaveBeenCalledWith('1W');
  });
});
