import React, { useState, useEffect } from "react";
import api from "../services/api";

const Funds = () => {
  const [funds, setFunds] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchFunds = async () => {
    try {
      const res = await api.get('/funds');
      setFunds(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching funds:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunds();
  }, []);

  if (loading) return <div className="funds"><p>Loading funds data...</p></div>;

  const data = funds || {
    totalBalance: 100000.00,
    blockedBalance: 0.00,
    availableBalance: 100000.00,
    ledger: []
  };

  return (
    <>
      <div className="funds" style={{ marginBottom: '20px' }}>
        <p>Educational Simulated Capital — ₹100,000 Starting Deposit</p>
      </div>

      <div className="row">
        <div className="col">
          <span>
            <p>Equity Funds Summary</p>
          </span>

          <div className="table">
            <div className="data">
              <p>Available cash</p>
              <p className="imp colored">₹{data.availableBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="data">
              <p>Used / Blocked margin</p>
              <p className="imp">₹{data.blockedBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="data">
              <p>Total account balance</p>
              <p className="imp">₹{data.totalBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <hr />
            <div className="data">
              <p>Opening Balance</p>
              <p>₹100,000.00</p>
            </div>
            <div className="data">
              <p>Simulated Brokerage Charges</p>
              <p>₹0.00 (Zero brokerage)</p>
            </div>
          </div>
        </div>

        <div className="col">
          <span>
            <p>Recent Cash Ledger History</p>
          </span>
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '4px', padding: '10px' }}>
            {data.ledger && data.ledger.length > 0 ? (
              <table style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
                    <th style={{ padding: '6px' }}>Time</th>
                    <th style={{ padding: '6px' }}>Type</th>
                    <th style={{ padding: '6px' }}>Amount</th>
                    <th style={{ padding: '6px' }}>Available After</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ledger.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '6px', color: '#888' }}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '6px', fontWeight: '500' }}>{item.type}</td>
                      <td style={{ padding: '6px', color: item.type.includes('BUY') ? '#df514c' : '#2e7d32', fontWeight: 'bold' }}>
                        {item.type.includes('BUY') ? '-' : '+'}₹{item.amount.toFixed(2)}
                      </td>
                      <td style={{ padding: '6px' }}>₹{item.balanceAfter.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#888', textAlign: 'center', margin: '15px 0' }}>No ledger movements recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Funds;
