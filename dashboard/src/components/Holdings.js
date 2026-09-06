import React, { useState, useEffect } from "react";
import api from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";

const Holdings = () => {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { marketData } = useWebSocket();

  const fetchHoldings = async () => {
    try {
      const res = await api.get('/holdings');
      setHoldings(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching holdings:', err);
      setHoldings([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHoldings();
  }, []);

  if (loading) {
    return <div className="holdings"><p>Loading holdings...</p></div>;
  }

  // Merge live WebSocket prices with backend-computed investment values.
  //
  // IMPORTANT: stock.investedValue, stock.pnl are computed server-side
  // using integer-paisa arithmetic and must NOT be recalculated here.
  //
  // We only override currValue (current market value) and derived P&L
  // when the WebSocket delivers a fresh price tick — because live LTP
  // is more up-to-date than the snapshot in the API response.
  let totalInvestment = 0;
  let currentValue = 0;

  const displayHoldings = holdings.map(stock => {
    const live = marketData[stock.name];

    // investedValue comes from the backend (paisa-precise). Never recalculate.
    const invValue = stock.investedValue;

    // currValue: use live tick if available, otherwise use backend snapshot.
    const ltp = live ? live.lastPrice : stock.price;
    const currValue = live
      ? parseFloat((ltp * stock.qty).toFixed(2))  // display-only, acceptable for live overlay
      : stock.currValue;                           // backend-computed otherwise

    const pnl = parseFloat((currValue - invValue).toFixed(2));
    const netChange = stock.avg > 0 ? ((ltp - stock.avg) / stock.avg) * 100 : 0;
    const dayChangePercent = live ? live.changePercent : parseFloat(stock.day || '0');

    totalInvestment += invValue;
    currentValue += currValue;

    return {
      ...stock,
      price: ltp,
      currValue,
      invValue,
      pnl,
      netChange,
      dayChangePercent,
      isProfit: pnl >= 0,
      isLoss: pnl < 0
    };
  });

  const totalPnL = currentValue - totalInvestment;
  const totalPnLPercent = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

  return (
    <>
      <h3 className="title">Holdings ({holdings.length})</h3>

      {holdings.length === 0 ? (
        <div className="no-orders" style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
          <p>You don't own any holdings yet. Use the Watchlist to place a Buy order.</p>
        </div>
      ) : (
        <div className="order-table">
          <table>
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Qty.</th>
                <th>Avg. cost</th>
                <th>LTP</th>
                <th>Cur. val</th>
                <th>P&L</th>
                <th>Net chg.</th>
                <th>Day chg.</th>
              </tr>
            </thead>
            <tbody>
              {displayHoldings.map((stock, index) => {
                const profClass = stock.isProfit ? "profit" : "loss";
                const dayClass = stock.dayChangePercent < 0 ? "loss" : "profit";
                return (
                  <tr key={index}>
                    <td>{stock.name}</td>
                    <td>{stock.qty} {stock.blockedQty > 0 ? <small style={{ color: '#e65100' }}>({stock.blockedQty} reserved)</small> : null}</td>
                    <td>₹{stock.avg.toFixed(2)}</td>
                    <td>₹{stock.price.toFixed(2)}</td>
                    <td>₹{stock.currValue.toFixed(2)}</td>
                    <td className={profClass}>₹{stock.pnl.toFixed(2)}</td>
                    <td className={profClass}>{stock.netChange >= 0 ? '+' : ''}{stock.netChange.toFixed(2)}%</td>
                    <td className={dayClass}>{stock.dayChangePercent >= 0 ? '+' : ''}{stock.dayChangePercent.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="row" style={{ marginTop: '20px' }}>
        <div className="col">
          <h5>
            ₹{totalInvestment.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h5>
          <p>Total investment</p>
        </div>
        <div className="col">
          <h5>
            ₹{currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h5>
          <p>Current value</p>
        </div>
        <div className="col">
          <h5 className={totalPnL >= 0 ? "profit" : "loss"}>
            ₹{totalPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
          </h5>
          <p>P&L</p>
        </div>
      </div>
    </>
  );
};

export default Holdings;
