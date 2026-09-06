import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE, DASHBOARD_URL } from '../../apiConfig';

const Login = () => {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState('password'); // 'password' | 'otp'

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        if (data.requiresVerification) {
          navigate('/verify-otp', { state: { email: email.trim(), type: 'EMAIL_VERIFICATION' } });
          return;
        }
        setError(data.message || 'Login failed. Please check your credentials.');
        return;
      }

      localStorage.setItem('tradepulse_token', data.token);
      if (data.user) localStorage.setItem('tradepulse_user', JSON.stringify(data.user));

      setSuccess('Login successful! Redirecting to dashboard...');
      setTimeout(() => {
        window.location.href = `${DASHBOARD_URL}/#tp_token=${data.token}&tp_user=${encodeURIComponent(JSON.stringify(data.user))}`;
      }, 500);
    } catch (err) {
      setLoading(false);
      setError('Network error. Unable to connect to server.');
    }
  };

  const handleSendLoginOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/auth/send-login-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.message || 'Failed to send OTP.');
        return;
      }

      navigate('/verify-otp', { state: { email: email.trim(), type: 'LOGIN_OTP' } });
    } catch (err) {
      setLoading(false);
      setError('Network error. Failed to send login OTP.');
    }
  };

  return (
    <div className="container mt-5 mb-5" style={{ maxWidth: '440px' }}>
      <div className="card shadow-sm border p-4 bg-white" style={{ borderRadius: '12px' }}>
        <div className="text-center mb-4">
          <h3 className="fw-bold text-dark mb-1">TradePulse Login</h3>
          <p className="text-secondary small">Access your paper trading dashboard</p>
        </div>

        {/* Mode Tabs */}
        <div className="d-flex mb-4 bg-light rounded p-1 border">
          <button
            className={`btn flex-fill py-1 small fw-bold ${authMode === 'password' ? 'btn-primary shadow-sm' : 'btn-light text-secondary'}`}
            onClick={() => { setAuthMode('password'); setError(''); }}
            style={authMode === 'password' ? { backgroundColor: '#0284c7', borderColor: '#0284c7', color: '#ffffff' } : { border: 'none' }}
          >
            Password Login
          </button>
          <button
            className={`btn flex-fill py-1 small fw-bold ${authMode === 'otp' ? 'btn-primary shadow-sm' : 'btn-light text-secondary'}`}
            onClick={() => { setAuthMode('otp'); setError(''); }}
            style={authMode === 'otp' ? { backgroundColor: '#0284c7', borderColor: '#0284c7', color: '#ffffff' } : { border: 'none' }}
          >
            OTP Login
          </button>
        </div>

        {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}
        {success && <div className="alert alert-success py-2 small mb-3">{success}</div>}

        {authMode === 'password' ? (
          <form onSubmit={handlePasswordLogin}>
            <div className="mb-3">
              <label className="form-label small text-secondary fw-semibold">Email Address</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
              />
            </div>

            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label small text-secondary fw-semibold mb-0">Password</label>
                <Link to="/forgot-password" className="small text-decoration-none fw-semibold" style={{ color: '#0284c7' }}>
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 py-2 fw-bold text-white mt-2 shadow-sm"
              disabled={loading}
              style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSendLoginOtp}>
            <div className="mb-3">
              <label className="form-label small text-secondary fw-semibold">Registered Email Address</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 py-2 fw-bold text-white mt-2 shadow-sm"
              disabled={loading}
              style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
            >
              {loading ? 'Sending OTP...' : 'Send Login OTP'}
            </button>
          </form>
        )}

        <div className="text-center mt-4 pt-2 border-top">
          <span className="small text-secondary">Don't have an account? </span>
          <Link to="/signup" className="small text-decoration-none fw-bold" style={{ color: '#0284c7' }}>
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
