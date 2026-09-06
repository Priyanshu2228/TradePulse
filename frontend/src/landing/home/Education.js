import React from 'react';
import { Link } from 'react-router-dom';

function Education() {
    return (
        <div className='container mb-5 p-5'>
            <div className='row align-items-center g-4'>
                <div className='col-lg-6 text-center'>
                    <img src='media/images/index-education.svg' alt='Education Illustration' className='img-fluid mb-3' style={{ maxWidth: "80%" }} />
                </div>
                <div className='col-lg-6'>
                    <h2 className='fw-bold mb-3 text-dark' style={{ color: '#0f172a' }}>Master Stock Market Dynamics</h2>
                    <p className='text-secondary mb-3 fs-6'>
                        Understand market mechanics, test strategies with live simulated tick movements, 
                        track real-time P&L, and refine your trading setup before putting real money on the line.
                    </p>
                    <div className='mt-4 d-flex gap-3'>
                        <Link to="/signup" className='btn btn-primary rounded-3 px-4 py-2 fw-bold text-white shadow-sm' style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}>
                            Start Learning <i className="fa-solid fa-graduation-cap ms-2"></i>
                        </Link>
                        <Link to="/login" className='btn btn-outline-secondary rounded-3 px-4 py-2 fw-semibold'>
                            Practice Account <i className="fa-solid fa-arrow-right ms-2"></i>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Education;