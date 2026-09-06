import React from 'react';
import { Link } from 'react-router-dom';

function Pricing() {
    return (
        <div className='container mb-5 p-5'>
            <div className='row align-items-center g-4'>
                <div className='col-lg-5'>
                    <h2 className='fw-bold mb-3 text-dark' style={{ color: '#0f172a' }}>100% Free Educational Platform</h2>
                    <p className='text-secondary mb-4 fs-6'>
                        TradePulse is completely free for students and paper trading enthusiasts. 
                        No hidden fees, no subscription costs, and no real money involved.
                    </p>
                    <Link to="/signup" className='btn btn-primary rounded-3 px-4 py-2 fw-semibold text-white shadow-sm' style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}>
                        Start Trading Free <i className="fa-solid fa-arrow-right ms-2"></i>
                    </Link>
                </div>
                <div className='col-lg-7 text-center'>
                    <img src='media/images/pricing.png' alt='TradePulse Zero Cost Structure' className='img-fluid rounded-3 shadow-sm border' style={{ maxWidth: "85%" }} />
                </div>
            </div>
        </div>
    );
}

export default Pricing;