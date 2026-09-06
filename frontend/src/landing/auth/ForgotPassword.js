import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../../apiConfig';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success

  const [email, setEmail] = useState('');
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  // Step 1: Submit Email
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.message || 'Failed to process request.');
        return;
      }

      setStep(2);
      setSuccess('If an account exists with this email, a reset OTP has been sent.');
    } catch (err) {
      setLoading(false);
      setError('Network error. Unable to connect to server.');
    }
  };

  // Step 2: Handle OTP Input
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
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otpValues.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: code })
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.message || 'Invalid or expired OTP.');
        return;
      }

      if (data.resetToken) {
        setResetToken(data.resetToken);
      }

      setStep(3);
      setError('');
      setSuccess('OTP verified successfully! Create a new password below.');
    } catch (err) {
      setLoading(false);
      setError('Network error. Unable to verify OTP.');
    }
  };

  // Step 3: Set New Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToken,
          newPassword
        })
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.message || 'Password reset failed.');
        return;
      }

      setStep(4);
      setSuccess('Password reset successful! You can now log in with your new password.');
    } catch (err) {
      setLoading(false);
      setError('Network error. Unable to reset password.');
    }
  };

  return (
    <div className="container mt-5 mb-5" style={{ maxWidth: '460px' }}>
      <div className="card shadow-sm border p-4 bg-white" style={{ borderRadius: '12px' }}>
        <div className="text-center mb-4">
          <h3 className="fw-bold text-dark mb-1">Reset Password</h3>
          <p className="text-secondary small">Follow the steps below to recover your account</p>
        </div>

        {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}
        {success && <div className="alert alert-success py-2 small mb-3">{success}</div>}

        {step === 1 && (
          <form onSubmit={handleRequestOtp}>
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
              className="btn btn-primary w-100 py-2 fw-bold text-white shadow-sm mt-2"
              disabled={loading}
              style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
            >
              {loading ? 'Sending OTP...' : 'Send Password Reset OTP'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp}>
            <div className="mb-3 text-center">
              <span className="small text-secondary">Enter 6-digit OTP sent to </span>
              <strong className="small text-dark">{email}</strong>
            </div>
            <div className="d-flex justify-content-between mb-4 gap-2">
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
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword}>
            <div className="mb-3">
              <label className="form-label small text-secondary fw-semibold">New Password</label>
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label small text-secondary fw-semibold">Confirm New Password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-100 py-2 fw-bold text-white shadow-sm mt-2"
              disabled={loading}
              style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
            >
              {loading ? 'Updating Password...' : 'Set New Password'}
            </button>
          </form>
        )}

        {step === 4 && (
          <div className="text-center mt-3">
            <button
              className="btn btn-primary w-100 py-2 fw-bold text-white shadow-sm"
              onClick={() => navigate('/login')}
              style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
            >
              Proceed to Login
            </button>
          </div>
        )}

        <div className="text-center mt-4 pt-2 border-top">
          <Link to="/login" className="small text-decoration-none fw-bold" style={{ color: '#0284c7' }}>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
