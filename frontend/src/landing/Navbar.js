import React from 'react';
import { Link } from 'react-router-dom';
import { DASHBOARD_URL } from '../apiConfig';

function Navbar() {
    const token = localStorage.getItem('tradepulse_token');

    return (
        <nav className="navbar navbar-expand-lg bg-white border-bottom shadow-sm py-3">
            <div className="container">
                <Link className="navbar-brand d-flex align-items-center gap-2" to={"/"}>
                    <span className="badge text-white fs-6 px-2 py-1 rounded-2" style={{ backgroundColor: "#0284c7" }}>TP</span>
                    <span className="fw-bold fs-5 text-dark tracking-wide">TradePulse</span>
                </Link>
                <button
                    className="navbar-toggler border-0"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarScroll"
                    aria-controls="navbarScroll"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarScroll">
                    <ul className="navbar-nav ms-auto my-2 my-lg-0 gap-3 align-items-center">
                        <li className="nav-item">
                            <Link className="nav-link text-secondary fw-semibold" to={"/about"}>About</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link text-secondary fw-semibold" to={"/products"}>Features</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link text-secondary fw-semibold" to={"/pricing"}>Pricing</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link text-secondary fw-semibold" to={"/support"}>Support</Link>
                        </li>
                        {token ? (
                            <li className="nav-item">
                                <a className="btn btn-primary btn-sm rounded-3 px-3 py-2 fw-bold text-white shadow-sm" href={DASHBOARD_URL} style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}>
                                    Go to Dashboard
                                </a>
                            </li>
                        ) : (
                            <>
                                <li className="nav-item">
                                    <Link className="btn btn-outline-secondary btn-sm rounded-3 px-3 py-2 fw-bold" to={"/login"}>Log In</Link>
                                </li>
                                <li className="nav-item">
                                    <Link className="btn btn-primary btn-sm rounded-3 px-3 py-2 fw-bold text-white shadow-sm" to={"/signup"} style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}>
                                        Start Practice
                                    </Link>
                                </li>
                            </>
                        )}
                    </ul>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;