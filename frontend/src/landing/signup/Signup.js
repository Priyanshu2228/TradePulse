import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE as API_URL } from '../../apiConfig';

function Signup() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), email: email.trim(), password })
            });

            const data = await res.json();
            setLoading(false);

            if (!res.ok) {
                setError(data.message || 'Signup failed.');
                return;
            }

            // Transition to Verify OTP screen
            navigate('/verify-otp', {
                state: {
                    email: email.trim(),
                    type: 'EMAIL_VERIFICATION'
                }
            });
        } catch (err) {
            setLoading(false);
            setError('Network error. Unable to connect to server.');
        }
    };

    return (
        <div className="container py-5" style={{ maxWidth: '460px' }}>
            <div className="card border shadow-sm p-4 bg-white" style={{ borderRadius: '12px' }}>
                <div className="text-center mb-4">
                    <h3 className="fw-bold text-dark mb-1">Create Account</h3>
                    <p className="text-secondary small">
                        Start practice trading with ₹100,000 virtual capital
                    </p>
                </div>

                {error && (
                    <div className="alert alert-danger py-2 px-3 small mb-3">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label small text-secondary fw-semibold">Full Name</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. Rahul Sharma"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <label className="form-label small text-secondary fw-semibold">Email Address</label>
                        <input
                            type="email"
                            className="form-control"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <label className="form-label small text-secondary fw-semibold">Password</label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder="At least 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <label className="form-label small text-secondary fw-semibold">Confirm Password</label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder="Re-enter password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary w-100 py-2 fw-bold text-white shadow-sm"
                        disabled={loading}
                        style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                    >
                        {loading ? 'Registering...' : 'Sign Up & Verify Email'}
                    </button>
                </form>

                <div className="text-center mt-4 pt-2 border-top">
                    <span className="small text-secondary">Already have an account? </span>
                    <Link to="/login" className="small text-decoration-none fw-bold" style={{ color: '#0284c7' }}>
                        Log In
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Signup;