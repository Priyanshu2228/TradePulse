import React, { useEffect, useState } from "react";
import api from "../services/api";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = async () => {
    try {
      const res = await api.get("/orders");
      setOrders(res.data);
      setLoading(false);
    } catch (err) {
      setError("Error fetching orders");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000); // Polling backup for order updates
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async (orderId) => {
    try {
      await api.delete(`/orders/${orderId}`);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel order");
    }
  };

  if (loading) return <div className="orders"><p>Loading orders...</p></div>;
  if (error) return <div className="orders"><p>{error}</p></div>;

  return (
    <div className="orders">
      <h3 className="title">Orders ({orders.length})</h3>
      {orders.length === 0 ? (
        <div className="no-orders" style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
          <p>You haven't placed any orders yet</p>
        </div>
      ) : (
        <div className="order-table">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Instrument</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, idx) => {
                const dateStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                let statusColor = '#888';
                if (order.status === 'FILLED') statusColor = '#2e7d32';
                if (order.status === 'OPEN') statusColor = '#0288d1';
                if (order.status === 'CANCELLED') statusColor = '#e65100';
                if (order.status === 'REJECTED') statusColor = '#c62828';

                return (
                  <tr key={idx}>
                    <td>{dateStr}</td>
                    <td>{order.orderType}</td>
                    <td><strong>{order.instrumentSymbol}</strong></td>
                    <td style={{ color: order.side === 'BUY' ? '#4184f3' : '#df514c', fontWeight: 'bold' }}>{order.side}</td>
                    <td>{order.quantity}</td>
                    <td>
                      {order.orderType === "MARKET" ? (
                        order.status === "FILLED" && order.executionPrice ? (
                          <span>₹{order.executionPrice.toFixed(2)} <small style={{ color: '#888', fontSize: '11px' }}>(MKT)</small></span>
                        ) : (
                          <span>MKT <small style={{ color: '#888', fontSize: '11px' }}>(~₹{order.price?.toFixed(2)})</small></span>
                        )
                      ) : (
                        `₹${order.price?.toFixed(2)}`
                      )}
                    </td>
                    <td>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', background: `${statusColor}15`, color: statusColor, fontWeight: 'bold', fontSize: '12px' }}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      {order.status === 'OPEN' ? (
                        <button
                          onClick={() => handleCancel(order._id)}
                          style={{ background: '#f44336', color: '#fff', border: 'none', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                      ) : '-'}
                    </td>
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

export default Orders;
