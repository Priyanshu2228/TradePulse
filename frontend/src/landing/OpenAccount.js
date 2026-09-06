import React from 'react';
import { Link } from 'react-router-dom';

function OpenAccount() {
    return (
        <div className='container p-5 text-center my-4 bg-light border shadow-sm' style={{ borderRadius: '16px' }}>
            <div className='row justify-content-center'>
                <div className='col-lg-8 py-3'>
                    <h2 className='mb-3 fw-bold text-dark' style={{ color: '#0f172a' }}>Start Practice Trading Today</h2>
                    <p className='fs-5 text-secondary mb-4'>
                        Open a free paper trading account to get instant ₹100,000 virtual capital, 
                        explore all supported Indian stock instruments, and master trading risk-free.
                    </p>
                    <Link 
                        to="/signup" 
                        className='btn btn-primary btn-lg rounded-3 px-5 py-3 fw-bold text-white shadow-sm'
                        style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                    >
                        Create Free Account <i className="fa-solid fa-arrow-right ms-2"></i>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default OpenAccount;