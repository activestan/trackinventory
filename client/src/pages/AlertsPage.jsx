import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import * as api from '../api/services';

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
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    load();
  }, []);

  return (
    <AppLayout title="Alerts & Notifications">
      <div className="page-toolbar">
        <button className="btn-secondary" onClick={() => api.exportAlertHistoryCsv()}>
          ⬇ Export Alert History CSV
        </button>
      </div>

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
    </AppLayout>
  );
}
