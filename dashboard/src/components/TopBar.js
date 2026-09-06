import React from "react";
import { useNavigate } from "react-router-dom";
import Menu from "./Menu";
import { useWebSocket } from "../hooks/useWebSocket";

const TopBar = () => {
  const { marketData } = useWebSocket();
  const navigate = useNavigate();

  const nifty = marketData["NIFTY 50"] || {};
  const sensex = marketData["SENSEX"] || {};

  const fmt = (v) => (typeof v === "number" ? v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—");
  const fmtPct = (v) => (typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "");

  const sample = Object.values(marketData)[0];
  const marketStatus = sample?.marketStatus || "OPEN";
  const isOpen = marketStatus === "OPEN";

  return (
    <div className="topbar-container">
      <div className="indices-container" style={{ alignItems: 'center' }}>
        <div
          className="nifty"
          onClick={() => navigate('/stock/NIFTY50')}
          style={{ cursor: 'pointer' }}
          title="View NIFTY 50 detail"
        >
          <p className="index">NIFTY 50</p>
          <p className="index-points">{fmt(nifty.lastPrice)}</p>
          <p className="percent" style={{ color: nifty.changePercent >= 0 ? "#4caf50" : "#f44336" }}>
            {fmtPct(nifty.changePercent)}
          </p>
        </div>
        <div
          className="sensex"
          onClick={() => navigate('/stock/SENSEX')}
          style={{ cursor: 'pointer' }}
          title="View SENSEX detail"
        >
          <p className="index">SENSEX</p>
          <p className="index-points">{fmt(sensex.lastPrice)}</p>
          <p className="percent" style={{ color: sensex.changePercent >= 0 ? "#4caf50" : "#f44336" }}>
            {fmtPct(sensex.changePercent)}
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          fontWeight: '700',
          color: isOpen ? '#047857' : '#b45309',
          padding: '3px 8px',
          borderRadius: '12px',
          background: isOpen ? '#ecfdf5' : '#fffbeb',
          border: `1px solid ${isOpen ? '#a7f3d0' : '#fef3c7'}`,
          marginLeft: '8px'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isOpen ? '#10b981' : '#f59e0b' }}></span>
          {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
        </div>
      </div>

      <Menu />
    </div>
  );
};

export default TopBar;
