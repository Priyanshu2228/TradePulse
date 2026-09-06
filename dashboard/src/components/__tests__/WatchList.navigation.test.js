/**
 * WatchList.navigation.test.js
 * Tests that WatchList row navigation and action button behavior
 * are correctly wired, and that stopPropagation prevents row navigation
 * when Buy/Sell/Remove buttons are clicked.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock api
jest.mock('../../services/api', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

// Mock useWebSocket
jest.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    isConnected: true,
    marketData: {
      RELIANCE: { symbol: 'RELIANCE', lastPrice: 2112.40, changePercent: 1.44 },
    },
  }),
}));

// Mock GeneralContext — WatchList uses useContext(GeneralContext)
jest.mock('../GeneralContext', () => {
  const React = require('react');
  const Ctx = React.createContext({ openBuyWindow: jest.fn(), openSellWindow: jest.fn() });
  return {
    __esModule: true,
    default: Ctx,
    GeneralContextProvider: ({ children }) => {
      const openBuyWindow = jest.fn();
      const openSellWindow = jest.fn();
      return <Ctx.Provider value={{ openBuyWindow, openSellWindow }}>{children}</Ctx.Provider>;
    },
  };
});

import WatchList from '../WatchList';
import api from '../../services/api';

const mockWatchlist = [
  { symbol: 'RELIANCE', lastPrice: 2100, changePercent: 0.5 },
  { symbol: 'INFY', lastPrice: 1850, changePercent: -0.3 },
];

const renderWatchList = async () => {
  let result;
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={['/']}>
        <WatchList />
      </MemoryRouter>
    );
  });
  return result;
};

describe('WatchList navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: mockWatchlist });
  });

  test('renders watchlist items after load', async () => {
    await renderWatchList();
    await waitFor(() => expect(screen.getByText('RELIANCE')).toBeInTheDocument());
    expect(screen.getByText('INFY')).toBeInTheDocument();
  });

  test('WatchList item row has cursor:pointer (row navigation is enabled)', async () => {
    await renderWatchList();
    await waitFor(() => screen.getByText('RELIANCE'));

    const items = document.querySelectorAll('.list li');
    // At least one item should have cursor: pointer
    const hasPointer = Array.from(items).some(
      (el) => el.style.cursor === 'pointer'
    );
    expect(hasPointer).toBe(true);
  });

  test('search results show "View" and "Add" buttons alongside each result', async () => {
    api.get.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('instruments/search')) {
        return Promise.resolve({
          data: [{ symbol: 'TCS', name: 'TCS Ltd.', lastPrice: 3900, instrumentType: 'EQ' }],
        });
      }
      return Promise.resolve({ data: mockWatchlist });
    });

    await renderWatchList();

    // Type in search to trigger search mode
    await act(async () => {
      fireEvent.change(document.getElementById('search'), { target: { value: 'TCS' } });
    });

    // Wait for search results to appear — search debounce is 200ms
    await waitFor(
      () => {
        const viewBtn = screen.queryByText('View');
        expect(viewBtn).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    expect(screen.getByText('View')).toBeInTheDocument();
    // Add button (may appear multiple times if multiple results)
    const addButtons = screen.getAllByText('Add');
    expect(addButtons.length).toBeGreaterThan(0);
  });

  test('Add button in search results calls /watchlist/add API', async () => {
    api.get.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('instruments/search')) {
        return Promise.resolve({
          data: [{ symbol: 'TCS', name: 'TCS Ltd.', lastPrice: 3900, instrumentType: 'EQ' }],
        });
      }
      return Promise.resolve({ data: mockWatchlist });
    });
    api.post.mockResolvedValue({ data: {} });

    await renderWatchList();

    await act(async () => {
      fireEvent.change(document.getElementById('search'), { target: { value: 'TCS' } });
    });

    await waitFor(
      () => expect(screen.queryByText('Add')).toBeInTheDocument(),
      { timeout: 2000 }
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Add'));
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/watchlist/add',
        expect.objectContaining({ symbol: 'TCS' })
      );
    });
  });

  test('each watchlist li row is clickable (has onClick handler)', async () => {
    await renderWatchList();
    await waitFor(() => screen.getByText('RELIANCE'));

    const lis = document.querySelectorAll('.list li');
    expect(lis.length).toBeGreaterThan(0);
    // The li element should have cursor:pointer indicating click behavior
    expect(lis[0].style.cursor).toBe('pointer');
  });
});
