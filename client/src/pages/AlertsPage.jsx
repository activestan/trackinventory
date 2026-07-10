import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import * as api from '../api/services';
import { useAuth } from '../context/AuthContext';

const TYPE_LABEL = {
  'Low-Stock': { icon: '⚠️', color: 'red' },
  'Asset-Overdue': { icon: '⏰', color: 'orange' },
  'Asset-Review': { icon: '🛠️', color: 'orange' },
};

function cooldownLabel(alert) {
  const info = alert.cooldown_info;
  if (!info || info.state === 'none') return null;

  if (info.state === 'cooling_down') {
    return `Next reminder due: ${new Date(info.next_reminder_at).toLocaleString()}`;
  }
  if (info.state === 'retry_cooldown') {
    return `Send failed repeatedly; next retry: ${new Date(info.next_reminder_at).toLocaleString()}`;
  }
  if (info.state === 'retrying_immediately') {
    return `Will retry on next check (${info.attempts_remaining} attempt(s) remaining)`;
  }
  return null;
}

export default function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const canTriggerCheck = user?.role === 'Administrator' || user?.role === 'Manager';
  const canClearHistory = user?.role === 'Administrator';

  async function load() {
    setLoading(true);
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (err) {
      setError('Unable to load alerts.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckNow() {
    setChecking(true);
    setCheckMessage('');
    setError('');
    try {
      await api.checkAlertsNow();
      setCheckMessage('Alert check completed. Any new or due alerts below have just been generated/emailed.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to run the alert check right now.');
    } finally {
      setChecking(false);
    }
  }

  async function handleClearHistoryConfirmed() {
    setClearing(true);
    setError('');
    setCheckMessage('');
    try {
      await api.clearAlertHistory();
      setConfirmingClear(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to clear alert history right now.');
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppLayout title="Alerts & Notifications">
      <div className="page-toolbar">
        {canTriggerCheck && (
          <button className="btn-primary" onClick={handleCheckNow} disabled={checking}>
            {checking ? '⏳ Checking...' : '🔔 Check Alerts Now'}
          </button>
        )}
        <button className="btn-secondary" onClick={() => api.exportAlertHistoryCsv()}>
          ⬇ Export Alert History CSV
        </button>
        {canClearHistory && alerts.length > 0 && (
          <button
            className="btn-secondary"
            style={{ color: '#dc2626' }}
            onClick={() => setConfirmingClear(true)}
          >
            🗑 Clear Alert History
          </button>
        )}
      </div>

      {canTriggerCheck && (
        <p className="muted" style={{ marginTop: -8, marginBottom: 16, fontSize: '0.85rem' }}>
          The system automatically checks stock and asset conditions every 30 minutes. Use "Check
          Alerts Now" to run that same check immediately, e.g. for a live demonstration.
        </p>
      )}

      {checkMessage && <div className="alert-banner alert-banner--success">{checkMessage}</div>}
      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      {loading ? (
        <p>Loading alerts...</p>
      ) : alerts.length === 0 ? (
        <div className="panel">
          <p className="muted">No alerts have been generated yet. Alerts appear automatically when a stock item falls to or below its reorder level, or when an asset requires review.</p>
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => {
            const meta = TYPE_LABEL[alert.alert_type] || { icon: '🔔', color: 'blue' };
            const cooldownText = cooldownLabel(alert);
            return (
              <div key={alert._id} className={`alert-card alert-card--${meta.color}`}>
                <div className="alert-card-icon">{meta.icon}</div>
                <div className="alert-card-body">
                  <div className="alert-card-message">{alert.message}</div>
                  <div className="alert-card-meta">
                    {new Date(alert.date_generated).toLocaleString()}
                  </div>
                  {cooldownText && (
                    <div className="alert-card-meta" style={{ marginTop: 4, fontStyle: 'italic' }}>
                      {cooldownText}
                    </div>
                  )}
                </div>
                <div className={`badge ${alert.status === 'Sent' ? 'badge-green' : alert.status === 'Failed' ? 'badge-red' : 'badge-orange'}`}>
                  {alert.status === 'Sent' ? '✔ Email Sent' : alert.status}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmingClear && (
        <Modal title="Confirm Clear Alert History" onClose={() => setConfirmingClear(false)}>
          <p>
            Are you sure you want to permanently clear all {alerts.length} alert record(s)? This
            cannot be undone. It does not change any stock quantities or asset custodianship —
            only the alert engine's record of what has already been reported. Any condition that
            is still unresolved will be treated as brand new and re-notified on the next check.
          </p>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setConfirmingClear(false)}>Cancel</button>
            <button
              className="btn-primary"
              style={{ background: '#dc2626' }}
              onClick={handleClearHistoryConfirmed}
              disabled={clearing}
            >
              {clearing ? 'Clearing...' : 'Yes, Clear History'}
            </button>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
