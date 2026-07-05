import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import * as api from '../api/services';

export default function AlertSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ cooldown_hours: '', failed_retry_cooldown_hours: '', max_send_attempts: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAlertSettings();
      setSettings(data);
      setForm({
        cooldown_hours: data.cooldown_hours,
        failed_retry_cooldown_hours: data.failed_retry_cooldown_hours,
        max_send_attempts: data.max_send_attempts,
      });
    } catch (err) {
      setError('Unable to load alert settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await api.updateAlertSettings(form);
      setSettings(updated);
      setSuccess('Alert settings updated. The new timing will apply from the next alert check onward.');
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating alert settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout title="Alert Settings">
      <div className="panel" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          Controls how often the automated alert engine re-notifies staff about a condition (e.g.
          low stock, an asset overdue for review) that remains unresolved between checks. Changes
          here apply immediately on the next scheduled or triggered check — no redeploy required.
        </p>
      </div>

      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      {success && <div className="alert-banner alert-banner--success">{success}</div>}

      {loading ? (
        <p>Loading settings...</p>
      ) : (
        <div className="panel">
          {settings && !settings.is_customized && (
            <p className="muted" style={{ marginTop: 0 }}>
              These are currently the system's default values. Saving below will store a custom
              configuration in the database, which takes priority over the defaults from then on.
            </p>
          )}
          <form onSubmit={handleSubmit} className="form-grid">
            <label>
              Reminder Cooldown (hours)
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={form.cooldown_hours}
                onChange={(e) => updateField('cooldown_hours', e.target.value)}
              />
              <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 400 }}>
                After an alert is successfully sent, how long to wait before sending another
                reminder for the same still-unresolved condition. Default: 12 hours.
              </span>
            </label>
            <label>
              Failed-Send Retry Cooldown (hours)
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={form.failed_retry_cooldown_hours}
                onChange={(e) => updateField('failed_retry_cooldown_hours', e.target.value)}
              />
              <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 400 }}>
                If an alert exhausts its maximum send attempts (all failed), how long to wait
                before giving it a fresh set of attempts. Default: 6 hours.
              </span>
            </label>
            <label>
              Maximum Send Attempts
              <input
                type="number"
                min="1"
                step="1"
                required
                value={form.max_send_attempts}
                onChange={(e) => updateField('max_send_attempts', e.target.value)}
              />
              <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 400 }}>
                How many times to retry sending a single alert (e.g. during a brief email provider
                outage) before pausing and applying the retry cooldown above. Default: 5.
              </span>
            </label>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
          {settings?.updated_at && (
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 12 }}>
              Last updated: {new Date(settings.updated_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </AppLayout>
  );
}
