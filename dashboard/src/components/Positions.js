import React, { useState, useEffect } from "react";
import api from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";

const Positions = () => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { marketData } = useWebSocket();

  const fetchPositions = async () => {
    try {
      const res = await api.get('/positions');
      setPositions(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching positions:', err);
      setPositions([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  if (loading) {
    return <div className="positions"><p>Loading positions...</p></div>;
  }

  const displayPositions = positions.map(p => {
    const live = marketData[p.name];
    const ltp = live ? live.lastPrice : p.price;
    const dayChangePercent = live ? live.changePercent : parseFloat(p.day || '0');

    return {
      ...p,
      price: ltp,
      dayChangePercent,
      isLoss: p.netPnL < 0
    };
  });

  return (
    <>
      <h3 className="title">Positions ({positions.length})</h3>

      {positions.length === 0 ? (
        <div className="no-orders" style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
          <p>No active positions for today.</p>
        </div>
      ) : (
        <div className="order-table">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Instrument</th>
                <th>Qty</th>
                <th>Avg.</th>
                <th>LTP</th>
                <th>P&L</th>
                <th>Chg.</th>
              </tr>
            </thead>
            <tbody>
              {displayPositions.map((stock, index) => {
                const profClass = stock.netPnL >= 0 ? "profit" : "loss";
                const dayClass = stock.dayChangePercent < 0 ? "loss" : "profit";
                return (
                  <tr key={index}>
                    <td>{stock.product}</td>
                    <td>{stock.name}</td>
                    <td>{stock.qty}</td>
                    <td>₹{stock.avg.toFixed(2)}</td>
                    <td>₹{stock.price.toFixed(2)}</td>
                    <td className={profClass}>₹{stock.netPnL.toFixed(2)}</td>
                    <td className={dayClass}>{stock.dayChangePercent >= 0 ? '+' : ''}{stock.dayChangePercent.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default Positions;
