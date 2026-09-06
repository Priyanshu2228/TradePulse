import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const FRONTEND_URL = process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";

const Menu = () => {
  const [selectedMenu, setSelectedMenu] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("tradepulse_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {}
    }
  }, []);

  const handleMenuClick = (index) => {
    setSelectedMenu(index);
  };

  const handleProfileClick = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem("tradepulse_token");
    localStorage.removeItem("tradepulse_user");
    window.location.href = `${FRONTEND_URL}/signup`;
  };

  const menuClass = "menu";
  const activeMenuClass = "menu selected";

  const initials = user && user.name ? user.name.substring(0, 2).toUpperCase() : "TP";

  return (
    <div className="menu-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px' }}>
        <div style={{ background: '#0284c7', color: '#fff', fontWeight: 'bold', padding: '6px 10px', borderRadius: '4px', fontSize: '14px' }}>
          TP
        </div>
        <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#0f172a' }}>TradePulse</span>
      </div>
      <div className="menus">
        <ul>
          <li>
            <Link to="/" onClick={() => handleMenuClick(0)} style={{ textDecoration: "none" }}>
              <p className={selectedMenu === 0 ? activeMenuClass : menuClass}>Dashboard</p>
            </Link>
          </li>
          <li>
            <Link to="/explore" onClick={() => handleMenuClick(6)} style={{ textDecoration: "none" }}>
              <p className={selectedMenu === 6 ? activeMenuClass : menuClass}>Explore</p>
            </Link>
          </li>
          <li>
            <Link to="/orders" onClick={() => handleMenuClick(1)} style={{ textDecoration: "none" }}>
              <p className={selectedMenu === 1 ? activeMenuClass : menuClass}>Orders</p>
            </Link>
          </li>
          <li>
            <Link to="/trades" onClick={() => handleMenuClick(2)} style={{ textDecoration: "none" }}>
              <p className={selectedMenu === 2 ? activeMenuClass : menuClass}>Trades</p>
            </Link>
          </li>
          <li>
            <Link to="/holdings" onClick={() => handleMenuClick(3)} style={{ textDecoration: "none" }}>
              <p className={selectedMenu === 3 ? activeMenuClass : menuClass}>Holdings</p>
            </Link>
          </li>
          <li>
            <Link to="/positions" onClick={() => handleMenuClick(4)} style={{ textDecoration: "none" }}>
              <p className={selectedMenu === 4 ? activeMenuClass : menuClass}>Positions</p>
            </Link>
          </li>
          <li>
            <Link to="/funds" onClick={() => handleMenuClick(5)} style={{ textDecoration: "none" }}>
              <p className={selectedMenu === 5 ? activeMenuClass : menuClass}>Funds</p>
            </Link>
          </li>
        </ul>
        <hr />
        <div className="profile" onClick={handleProfileClick} style={{ position: 'relative', cursor: 'pointer' }}>
          <div className="avatar">{initials}</div>
          <p className="username">{user ? user.name : "Trader"}</p>
        </div>
        {isProfileOpen && (
          <div className="profile-dropdown" style={{ position: 'absolute', right: '15px', top: '50px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 100 }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: '5px 0' }}>
              <li style={{ padding: '8px 15px', fontSize: '13px', color: '#666', borderBottom: '1px solid #eee' }}>
                {user ? user.email : "trader@tradepulse.io"}
              </li>
              <li
                onClick={handleLogout}
                style={{ padding: '8px 15px', fontSize: '13px', color: '#d32f2f', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Logout
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Menu;
