import React from 'react';
import { Link } from 'react-router-dom';

function Footer() {
    return (
        <footer className='border-top py-5 bg-white' style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
            <div className='container'>
                <div className='row g-4'>
                    <div className='col-lg-4 col-md-6'>
                        <div className="d-flex align-items-center mb-3">
                            <span className="badge text-white fs-5 px-3 py-1 me-2 rounded-2" style={{ backgroundColor: '#0284c7' }}>TP</span>
                            <span className="fs-4 fw-bold text-dark tracking-wide">TradePulse</span>
                        </div>
                        <p className="small mb-3 text-secondary">
                            Student Paper Trading Platform. Strictly for educational & simulation purposes. 
                            No real money, no broker integration, and zero financial risk.
                        </p>
                        <p className="small text-muted">© 2026 TradePulse Platform. All rights reserved.</p>
                    </div>
                    <div className='col-lg-2 col-md-6'>
                        <h6 className="fw-bold text-dark mb-3">Platform</h6>
                        <ul className='list-unstyled small d-flex flex-column gap-2 mb-0'>
                            <li><Link to="/signup" className="text-decoration-none text-secondary">Create Account</Link></li>
                            <li><Link to="/login" className="text-decoration-none text-secondary">Account Login</Link></li>
                            <li><Link to="/forgot-password" className="text-decoration-none text-secondary">Reset Password</Link></li>
                        </ul>
                    </div>
                    <div className='col-lg-3 col-md-6'>
                        <h6 className="fw-bold text-dark mb-3">Paper Trading Features</h6>
                        <ul className='list-unstyled small d-flex flex-column gap-2 mb-0'>
                            <li><span className="text-secondary">₹100,000 Virtual Capital</span></li>
                            <li><span className="text-secondary">Simulated Indian Stock Universe</span></li>
                            <li><span className="text-secondary">User Isolated Watchlist</span></li>
                            <li><span className="text-secondary">Real-Time Price Updates</span></li>
                        </ul>
                    </div>
                    <div className='col-lg-3 col-md-6'>
                        <h6 className="fw-bold text-dark mb-3">Security & Integrity</h6>
                        <ul className='list-unstyled small d-flex flex-column gap-2 mb-0'>
                            <li><span className="text-secondary">OTP Email Ownership Check</span></li>
                            <li><span className="text-secondary">Disposable Domain Defense</span></li>
                            <li><span className="text-secondary">Bcrypt Password Protection</span></li>
                            <li><span className="text-secondary">Double-Entry Financial Ledger</span></li>
                        </ul>
                    </div>
                </div>

                <div className='row mt-5 pt-4 border-top'>
                    <div className='col-12 text-center small text-muted'>
                        <p className="mb-1">
                            TradePulse is an open-source educational project. All market data displayed is dynamically simulated unless historical data is explicitly labelled for educational reference.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default Footer;