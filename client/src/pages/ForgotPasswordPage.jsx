import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/services';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
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
        <h1 className="login-title">Reset Your Password</h1>
        <p className="login-subtitle">
          Enter your account email and we'll send you a link to reset your password.
        </p>

        {error && <div className="alert-banner alert-banner--error">{error}</div>}

        {submitted ? (
          <div className="alert-banner alert-banner--success">
            A password reset link has been sent to your email address. Please check your inbox
            (and spam folder) — the link is valid for 30 minutes.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <label>
              Email Address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@business.com"
              />
            </label>
            <button type="submit" className="btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
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
