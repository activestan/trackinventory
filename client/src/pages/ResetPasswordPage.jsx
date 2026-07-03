import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import * as api from '../api/services';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const linkIsValid = Boolean(email && token);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(email, token, newPassword);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="brand-icon">📦</span>
        </div>
        <h1 className="login-title">Set a New Password</h1>

        {!linkIsValid ? (
          <div className="alert-banner alert-banner--error">
            This password reset link is missing required information. Please request a new link.
          </div>
        ) : success ? (
          <div className="alert-banner alert-banner--success">
            Your password has been reset successfully. Redirecting you to the login page...
          </div>
        ) : (
          <>
            <p className="login-subtitle">Resetting password for {email}</p>
            {error && <div className="alert-banner alert-banner--error">{error}</div>}
            <form onSubmit={handleSubmit} className="login-form">
              <label>
                New Password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <label>
                Confirm New Password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
              <button type="submit" className="btn-primary btn-block" disabled={submitting}>
                {submitting ? 'Saving...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        <p style={{ marginTop: 18, fontSize: '0.85rem' }}>
          <Link to="/login" style={{ color: '#2f6fed', fontWeight: 600 }}>
            ← Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}
