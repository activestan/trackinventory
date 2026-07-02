import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import * as api from '../api/services';

const TYPE_LABEL = {
  'Low-Stock': { icon: '⚠️', color: 'red' },
  'Asset-Overdue': { icon: '⏰', color: 'orange' },
  'Asset-Review': { icon: '🛠️', color: 'orange' },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getAlerts();
        setAlerts(data);
      } catch (err) {
        setError('Unable to load alerts.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AppLayout title="Alerts & Notifications">
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
            return (
              <div key={alert._id} className={`alert-card alert-card--${meta.color}`}>
                <div className="alert-card-icon">{meta.icon}</div>
                <div className="alert-card-body">
                  <div className="alert-card-message">{alert.message}</div>
                  <div className="alert-card-meta">
                    {new Date(alert.date_generated).toLocaleString()}
                  </div>
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
