/**
 * useHistoricalData.js
 * Custom hook. Owns all historical OHLC data fetching logic.
 *
 * Parameters: { symbol, range, interval }
 * Returns:    { data, loading, error, isEmpty, sourceCode, count }
 *
 * Behaviour:
 * - Uses AbortController to cancel in-flight requests when params change
 * - Skips fetch if params are identical to previous fetch (deduplication)
 * - Does NOT cache on the frontend — backend provides 5-minute TTL cache
 * - Decodes symbol via decodeURIComponent before use (handles M%26M -> M&M)
 * - Never fabricates missing data — returns error/empty states honestly
 */
import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const useHistoricalData = ({ symbol, range, interval }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [sourceCode, setSourceCode] = useState(null);
  const [count, setCount] = useState(0);

  // Track last fetched params to avoid redundant requests
  const lastParamsRef = useRef(null);

  useEffect(() => {
    if (!symbol || !range || !interval) return;

    // Decode the symbol in case it came from URL params (e.g. M%26M -> M&M)
    const decodedSymbol = decodeURIComponent(symbol);

    const paramsKey = `${decodedSymbol}:${range}:${interval}`;

    // Skip if same params — already have this data
    if (lastParamsRef.current === paramsKey) return;

    const controller = new AbortController();
    lastParamsRef.current = paramsKey;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setIsEmpty(false);
      setData([]);
      setSourceCode(null);
      setCount(0);

      try {
        // encodeURIComponent handles M&M -> M%26M in the URL path
        const encodedSymbol = encodeURIComponent(decodedSymbol);
        const response = await api.get(
          `/historical/${encodedSymbol}`,
          {
            params: { range, interval },
            signal: controller.signal,
          }
        );

        const result = response.data;
        const candles = result.data || [];

        setData(candles);
        setCount(result.count || 0);
        setIsEmpty(candles.length === 0);

        // Determine source from first candle — all candles in a batch share the same source
        if (candles.length > 0 && candles[0].source) {
          setSourceCode(candles[0].source);
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          // Cancelled by component unmount or param change — not an error
          lastParamsRef.current = null; // Allow re-fetch with same params if needed
          return;
        }

        const status = err.response?.status;
        const apiError = err.response?.data?.error;
        const apiMessage = err.response?.data?.message;

        if (status === 404) {
          setError({ type: 'NOT_FOUND', message: apiMessage || 'Instrument not found.' });
        } else if (status === 400 && apiError === 'UNSUPPORTED_INTERVAL') {
          setError({ type: 'UNSUPPORTED_INTERVAL', message: apiMessage || 'Interval not supported.' });
        } else if (!err.response) {
          setError({ type: 'NETWORK', message: 'Network error. Please check your connection.' });
        } else {
          setError({ type: 'UNKNOWN', message: apiMessage || 'Failed to load historical data.' });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [symbol, range, interval]);

  // Expose a refetch function that clears the deduplication key
  const refetch = () => {
    lastParamsRef.current = null;
  };

  return { data, loading, error, isEmpty, sourceCode, count, refetch };
};

export default useHistoricalData;
