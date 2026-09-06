/**
 * ChartDataBadge.test.js
 * Tests for the provenance badge component.
 * Verifies that the backend source field drives the displayed label.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import ChartDataBadge from '../ChartDataBadge';

describe('ChartDataBadge', () => {
  test('renders "YAHOO FINANCE • EOD" for YAHOO_FINANCE source', () => {
    render(<ChartDataBadge sourceCode="YAHOO_FINANCE" />);
    expect(screen.getByText('YAHOO FINANCE • EOD')).toBeInTheDocument();
  });

  test('renders "SIMULATED • 1 MIN" for SIMULATION source with interval="1m"', () => {
    render(<ChartDataBadge sourceCode="SIMULATION" interval="1m" />);
    expect(screen.getByText('SIMULATED • 1 MIN')).toBeInTheDocument();
  });

  test('renders "SIMULATED • 15 MIN" for SIMULATION source with interval="15m"', () => {
    render(<ChartDataBadge sourceCode="SIMULATION" interval="15m" />);
    expect(screen.getByText('SIMULATED • 15 MIN')).toBeInTheDocument();
  });

  test('renders "Synthetic (Test Data)" for SYNTHETIC source', () => {
    render(<ChartDataBadge sourceCode="SYNTHETIC" />);
    expect(screen.getByText('Synthetic (Test Data)')).toBeInTheDocument();
  });

  test('renders raw source code for unknown sources', () => {
    render(<ChartDataBadge sourceCode="CUSTOM_PROVIDER_V2" />);
    expect(screen.getByText('CUSTOM_PROVIDER_V2')).toBeInTheDocument();
  });

  test('renders nothing when sourceCode is null', () => {
    const { container } = render(<ChartDataBadge sourceCode={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when sourceCode is undefined', () => {
    const { container } = render(<ChartDataBadge />);
    expect(container.firstChild).toBeNull();
  });

  test('badge has correct class name', () => {
    const { container } = render(<ChartDataBadge sourceCode="YAHOO_FINANCE" />);
    expect(container.querySelector('.chart-data-badge')).toBeInTheDocument();
  });
});
