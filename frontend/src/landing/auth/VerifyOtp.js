import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE, DASHBOARD_URL } from '../../apiConfig';

const VerifyOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const initialEmail = location.state?.email || '';
  const otpType = location.state?.type || 'EMAIL_VERIFICATION';

  const [email, setEmail] = useState(initialEmail);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;

    const newValues = [...otpValues];
    newValues[index] = value;
    setOtpValues(newValues);
    setError('');

    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otpValues[index] && index > 0) {
        inputRefs[index - 1].current?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtpValues(digits);
      inputRefs[5].current?.focus();
    }
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    const code = otpValues.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return;
    }

    if (!email) {
      setError('Email address is missing.');
      return;
    }

    setLoading(true);
    setError('');

    const endpoint = otpType === 'LOGIN_OTP' ? '/auth/verify-login-otp' : '/auth/verify-otp';

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code })
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.message || 'OTP verification failed.');
        return;
      }

      setSuccess('Verification successful! Redirecting...');

      if (data.token) {
        localStorage.setItem('tradepulse_token', data.token);
        if (data.user) localStorage.setItem('tradepulse_user', JSON.stringify(data.user));

        setTimeout(() => {
          window.location.href = `${DASHBOARD_URL}/#tp_token=${data.token}&tp_user=${encodeURIComponent(JSON.stringify(data.user))}`;
        }, 1000);
      } else {
        setTimeout(() => navigate('/login'), 1500);
      }
    } catch (err) {
      setLoading(false);
      setError('Network error. Unable to connect to server.');
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: otpType })
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.message || 'Failed to resend OTP.');
        return;
      }

      setSuccess('A new OTP has been sent to your email.');
      setCountdown(60);
    } catch (err) {
      setLoading(false);
      setError('Network error. Failed to resend OTP.');
    }
  };

  return (
    <div className="container mt-5 mb-5" style={{ maxWidth: '480px' }}>
      <div className="card shadow-sm border p-4 bg-white" style={{ borderRadius: '12px' }}>
        <div className="text-center mb-4">
          <h3 className="fw-bold text-dark mb-1">Verify Email OTP</h3>
          <p className="text-secondary small">
            Enter the 6-digit code sent to <strong className="text-dark">{email || 'your email'}</strong>
          </p>
        </div>

        {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}
        {success && <div className="alert alert-success py-2 small mb-3">{success}</div>}

        <form onSubmit={handleVerify}>
          {!initialEmail && (
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
          )}

          <div className="d-flex justify-content-between mb-4 gap-2" onPaste={handlePaste}>
            {otpValues.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                maxLength={1}
                className="form-control text-center fw-bold fs-4 bg-light text-dark border"
                style={{ width: '52px', height: '56px', borderRadius: '8px' }}
                value={digit}
                onChange={e => handleOtpChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
              />
            ))}
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 py-2 fw-bold text-white shadow-sm"
            disabled={loading || otpValues.join('').length !== 6}
            style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
          >
            {loading ? 'Verifying...' : 'Verify OTP & Continue'}
          </button>
        </form>

        <div className="text-center mt-4 pt-2 border-top">
          <button
            className="btn btn-link text-decoration-none small text-secondary p-0 fw-semibold"
            onClick={handleResend}
            disabled={countdown > 0 || loading}
          >
            {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtp;
