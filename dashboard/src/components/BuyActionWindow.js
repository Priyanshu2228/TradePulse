import React, { useState, useContext, useEffect } from "react";
import api from "../services/api";
import GeneralContext from "./GeneralContext";
import "./BuyActionWindow.css";

const BuyActionWindow = ({ uid, mode, onOrderSuccess }) => {
    const [orderType, setOrderType] = useState("MARKET");
    const [stockQuantity, setStockQuantity] = useState(1);
    const [stockPrice, setStockPrice] = useState(0.0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const { closeBuyWindow, closeSellWindow } = useContext(GeneralContext);

    // Fetch current price for default input value
    useEffect(() => {
        api.get(`/instruments/search?q=${uid}`)
            .then(res => {
                if (res.data && res.data.length > 0) {
                    setStockPrice(res.data[0].lastPrice);
                }
            })
            .catch(() => { });
    }, [uid]);

    const requiredMargin = (Number(stockQuantity || 0) * Number(stockPrice || 0)).toFixed(2);

    const handleActionClick = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");
        setLoading(true);

        const idempotencyKey = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        try {
            const res = await api.post("/orders", {
                instrumentSymbol: uid,
                side: mode,
                quantity: Number(stockQuantity),
                orderType: orderType,
                price: Number(stockPrice),
                idempotencyKey
            });

            setSuccessMsg(res.data.message || `Order ${mode} submitted!`);
            setLoading(false);

            if (onOrderSuccess) onOrderSuccess();

            setTimeout(() => {
                if (mode === "BUY") {
                    closeBuyWindow();
                } else {
                    closeSellWindow();
                }
            }, 1000);
        } catch (err) {
            setLoading(false);
            const msg = err.response?.data?.message || err.message || "Failed to place order";
            setError(msg);
        }
    };

    const handleCancelClick = (e) => {
        e.preventDefault();
        if (mode === "BUY") {
            closeBuyWindow();
        } else {
            closeSellWindow();
        }
    };

    return (
        <div className="container" id="buy-window" style={{ zIndex: 1000 }}>
            <div className="order-header" style={{ padding: '10px 15px', background: mode === "BUY" ? '#4184f3' : '#df514c', color: '#fff', borderRadius: '4px 4px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h5 style={{ margin: 0, fontSize: '16px' }}>{mode} {uid}</h5>
                <span style={{ fontSize: '12px', opacity: 0.9 }}>NSE</span>
            </div>

            <div className="regular-order" style={{ padding: '15px' }}>
                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                    <label style={{ cursor: 'pointer', fontSize: '14px', fontWeight: orderType === "MARKET" ? "bold" : "normal" }}>
                        <input
                            type="radio"
                            name="orderType"
                            value="MARKET"
                            checked={orderType === "MARKET"}
                            onChange={() => setOrderType("MARKET")}
                            style={{ marginRight: '5px' }}
                        />
                        Market
                    </label>
                    <label style={{ cursor: 'pointer', fontSize: '14px', fontWeight: orderType === "LIMIT" ? "bold" : "normal" }}>
                        <input
                            type="radio"
                            name="orderType"
                            value="LIMIT"
                            checked={orderType === "LIMIT"}
                            onChange={() => setOrderType("LIMIT")}
                            style={{ marginRight: '5px' }}
                        />
                        Limit
                    </label>
                </div>

                <div className="inputs">
                    <fieldset>
                        <legend>Qty.</legend>
                        <input
                            type="number"
                            name="qty"
                            id="qty"
                            min="1"
                            onChange={(e) => setStockQuantity(e.target.value)}
                            value={stockQuantity}
                        />
                    </fieldset>
                    <fieldset>
                        <legend>Price</legend>
                        <input
                            type="number"
                            name="price"
                            id="price"
                            step="0.05"
                            disabled={orderType === "MARKET"}
                            onChange={(e) => setStockPrice(e.target.value)}
                            value={stockPrice}
                        />
                    </fieldset>
                </div>
                {orderType === "MARKET" && (
                    <small style={{ color: '#777', display: 'block', marginTop: '4px', fontSize: '11px' }}>
                        * Market orders execute at the next market tick price. Indicative submission price shown.
                    </small>
                )}

                {error && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', background: '#ffebee', color: '#c62828', borderRadius: '4px', fontSize: '13px' }}>
                        {error}
                    </div>
                )}

                {successMsg && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', fontSize: '13px' }}>
                        {successMsg}
                    </div>
                )}
            </div>

            <div className="buttons" style={{ padding: '10px 15px', background: '#f9f9f9', borderTop: '1px solid #eee' }}>
                <span style={{ fontSize: '13px', color: '#666' }}>
                    {mode === "BUY" ? "Margin required" : "Order value"}: <strong>₹{requiredMargin}</strong>
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className={`btn ${mode === "BUY" ? "btn-blue" : "btn-red"}`}
                        onClick={handleActionClick}
                        disabled={loading}
                    >
                        {loading ? "Submitting..." : (mode === "BUY" ? "Buy" : "Sell")}
                    </button>
                    <button className="btn btn-grey" onClick={handleCancelClick} disabled={loading}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BuyActionWindow;