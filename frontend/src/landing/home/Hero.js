import React from 'react';
import { Link } from 'react-router-dom';

function Hero() {
    return (
        <div className='container p-5 text-center my-3'>
            <div className='row justify-content-center align-items-center'>
                <div className='col-lg-9'>
                    <img 
                        src='media/images/landing.png' 
                        alt='TradePulse Paper Trading Platform' 
                        className='img-fluid mb-5 rounded-4 shadow-sm border' 
                        style={{ maxHeight: '380px', objectFit: 'cover' }}
                    />
                    <h1 className='display-4 fw-bold mb-3 text-dark' style={{ color: '#0f172a' }}>
                        Trade & Learn with Zero Financial Risk
                    </h1>
                    <p className='fs-5 text-secondary mb-4 px-md-5'>
                        TradePulse gives you ₹100,000 virtual capital, real-time simulated Indian stock market feeds, 
                        user-isolated watchlists, and full paper trading ledger auditability.
                    </p>
                    <div className='d-flex justify-content-center gap-3 mt-4'>
                        <Link 
                            to="/signup" 
                            className='btn btn-primary btn-lg rounded-3 px-4 py-3 fw-bold shadow-sm'
                            style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                        >
                            Get Started for Free <i className="fa-solid fa-arrow-right ms-2"></i>
                        </Link>
                        <Link 
                            to="/login" 
                            className='btn btn-outline-secondary btn-lg rounded-3 px-4 py-3 fw-bold'
                        >
                            Log In to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Hero;