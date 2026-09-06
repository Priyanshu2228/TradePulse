import React from 'react';
import { Link } from 'react-router-dom';

function Stats() {
    return (
        <div className='container p-5 my-4'>
            <div className='row align-items-center g-5'>
                <div className='col-lg-6'>
                    <h2 className='mb-4 fw-bold text-dark' style={{ color: '#0f172a' }}>Built for Learning & Financial Precision</h2>
                    
                    <div className='mb-4 p-4 rounded-3 bg-light border'>
                        <h5 className='fw-bold text-dark mb-2'>100% Risk-Free Environment</h5>
                        <p className='text-secondary mb-0 small'>
                            Practice paper trading with ₹100,000 in virtual funds. Master market dynamics without risking real financial capital.
                        </p>
                    </div>

                    <div className='mb-4 p-4 rounded-3 bg-light border'>
                        <h5 className='fw-bold text-dark mb-2'>Real-Time Simulation Universe</h5>
                        <p className='text-secondary mb-0 small'>
                            Experience realistic market price movements across all major Indian equities with session control and volatility modeling.
                        </p>
                    </div>

                    <div className='mb-4 p-4 rounded-3 bg-light border'>
                        <h5 className='fw-bold text-dark mb-2'>User-Isolated Watchlist & Ledger</h5>
                        <p className='text-secondary mb-0 small'>
                            Keep track of your favorite stocks, portfolio holdings, execution log, and performance P&L with robust backend integrity.
                        </p>
                    </div>
                </div>

                <div className='col-lg-6 text-center'>
                    <div className='p-4 rounded-4 shadow-sm border bg-white'>
                        <img src='media/images/ecosystem.png' alt='TradePulse Platform Feature Overview' className='img-fluid rounded-3 mb-4' />
                        <div className='d-flex justify-content-center gap-3'>
                            <Link to="/signup" className='btn btn-primary rounded-3 px-4 py-2 fw-semibold text-white shadow-sm' style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}>
                                Explore Simulator <i className="fa-solid fa-arrow-right ms-1"></i>
                            </Link>
                            <Link to="/login" className='btn btn-outline-secondary rounded-3 px-4 py-2 fw-semibold'>
                                View Dashboard <i className="fa-solid fa-arrow-right ms-1"></i>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Stats;