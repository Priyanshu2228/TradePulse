import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080/ws';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [marketData, setMarketData] = useState({});
  const wsRef = useRef(null);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log('[TradePulse WebSocket] Connected to real-time market stream.');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'SNAPSHOT' || message.type === 'TICK') {
            setMarketData((prev) => {
              const updated = { ...prev };
              const items = Array.isArray(message.data) ? message.data : [message.data];
              items.forEach((item) => {
                if (item && item.symbol) {
                  updated[item.symbol] = item;
                }
              });
              return updated;
            });
          }
        } catch (err) {
          console.error('[TradePulse WebSocket] Message parse error:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('[TradePulse WebSocket] Connection closed. Retrying in 3s...');
        setTimeout(() => connect(), 3000);
      };

      ws.onerror = (err) => {
        console.error('[TradePulse WebSocket] Error:', err);
        ws.close();
      };
    } catch (err) {
      console.error('[TradePulse WebSocket] Connection exception:', err);
      setTimeout(() => connect(), 3000);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, marketData };
}
