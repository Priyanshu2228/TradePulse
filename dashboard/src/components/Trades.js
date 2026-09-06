import React, { useState, useEffect } from "react";
import api from "../services/api";

const Trades = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/trades")
      .then((res) => {
        setTrades(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching trades:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="orders"><p>Loading trades history...</p></div>;

  return (
    <div className="orders">
      <h3 className="title">Trades History ({trades.length})</h3>
      {trades.length === 0 ? (
        <div className="no-orders" style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
          <p>No executed trades recorded yet.</p>
        </div>
      ) : (
        <div className="order-table">
          <table>
            <thead>
              <tr>
                <th>Execution Time</th>
                <th>Instrument</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Execution Price</th>
                <th>Total Value</th>
                <th>Charges</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, idx) => {
                const dateStr = new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return (
                  <tr key={idx}>
                    <td>{dateStr}</td>
                    <td><strong>{trade.instrumentSymbol}</strong></td>
                    <td style={{ color: trade.side === 'BUY' ? '#4184f3' : '#df514c', fontWeight: 'bold' }}>{trade.side}</td>
                    <td>{trade.quantity}</td>
                    <td>₹{trade.price?.toFixed(2)}</td>
                    <td>₹{trade.value?.toFixed(2)}</td>
                    <td>₹{trade.charges?.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Trades;
