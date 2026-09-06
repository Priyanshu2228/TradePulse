import React, { useState, useEffect } from "react";
import api from "../services/api";

const Summary = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("tradepulse_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {}
    }

    api.get("/summary")
      .then((res) => {
        setSummary(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching summary:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="summary"><p>Loading summary...</p></div>;
  }

  const data = summary || {
    availableMargin: 100000.00,
    usedMargin: 0.00,
    totalBalance: 100000.00,
    holdingsCount: 0,
    totalInvestment: 0.00,
    currentValue: 0.00,
    totalPnL: 0.00,
    pnlPercentage: 0.00
  };

  const isProfit = data.totalPnL >= 0;

  return (
    <>
      <div className="username">
        <h6>Hi, {user ? user.name : "Trader"}!</h6>
        <hr className="divider" />
      </div>

      <div className="section">
        <span>
          <p>Equity & Funds</p>
        </span>

        <div className="data">
          <div className="first">
            <h3>₹{data.availableMargin?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
            <p>Margin available</p>
          </div>
          <hr />

          <div className="second">
            <p>
              Margins used <span>₹{data.usedMargin?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </p>
            <p>
              Total cash balance <span>₹{data.totalBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
        </div>
        <hr className="divider" />
      </div>

      <div className="section">
        <span>
          <p>Holdings ({data.holdingsCount})</p>
        </span>

        <div className="data">
          <div className="first">
            <h3 className={isProfit ? "profit" : "loss"}>
              ₹{data.totalPnL?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{" "}
              <small>({data.pnlPercentage >= 0 ? '+' : ''}{data.pnlPercentage?.toFixed(2)}%)</small>
            </h3>
            <p>P&L</p>
          </div>
          <hr />

          <div className="second">
            <p>
              Current Value <span>₹{data.currentValue?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </p>
            <p>
              Investment <span>₹{data.totalInvestment?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
        </div>
        <hr className="divider" />
      </div>
    </>
  );
};

export default Summary;
