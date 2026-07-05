const Alert = require('../models/Alert');
const { runAlertCheckNow, getEffectiveSettings } = require('../jobs/alertScheduler');

/**
 * Annotates a raised alert document with information about when (if
 * ever) the next reminder/retry for its underlying condition will be
 * considered, so the UI can show something more informative than a bare
 * status badge (e.g. "next reminder at 14:30" instead of leaving staff
 * to wonder why a still-unresolved low-stock condition hasn't triggered
 * another email yet).
 */
function annotateCooldownState(alertDoc, settings) {
  const alert = alertDoc.toObject ? alertDoc.toObject() : alertDoc;

  if (alert.status === 'Sent' && alert.date_sent) {
    const nextReminderAt = new Date(new Date(alert.date_sent).getTime() + settings.cooldown_hours * 60 * 60 * 1000);
    alert.cooldown_info = {
      state: 'cooling_down',
      next_reminder_at: nextReminderAt,
      cooldown_hours: settings.cooldown_hours,
    };
  } else if (alert.status === 'Failed' && (alert.send_attempts || 0) >= settings.max_send_attempts) {
    const nextRetryAt = new Date(new Date(alert.updated_at).getTime() + settings.failed_retry_cooldown_hours * 60 * 60 * 1000);
    alert.cooldown_info = {
      state: 'retry_cooldown',
      next_reminder_at: nextRetryAt,
      cooldown_hours: settings.failed_retry_cooldown_hours,
    };
  } else if (alert.status === 'Failed' || alert.status === 'Pending') {
    alert.cooldown_info = {
      state: 'retrying_immediately',
      attempts_remaining: Math.max(settings.max_send_attempts - (alert.send_attempts || 0), 0),
    };
  } else {
    alert.cooldown_info = { state: 'none' };
  }

  return alert;
}

// GET /api/alerts - list all alerts (most recent first)
async function listAlerts(req, res) {
  try {
    const { status, alert_type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (alert_type) filter.alert_type = alert_type;

    const [alerts, settings] = await Promise.all([
      Alert.find(filter)
        .populate('related_item_id', 'item_name sku_code quantity_on_hand reorder_level')
        .populate('related_asset_id', 'asset_tag_no asset_name')
        .sort({ date_generated: -1 }),
      getEffectiveSettings(),
    ]);

    res.json(alerts.map((a) => annotateCooldownState(a, settings)));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching alerts.', error: error.message });
  }
}

// GET /api/alerts/summary - counts used by the dashboard
async function alertSummary(req, res) {
  try {
    const pending = await Alert.countDocuments({ status: 'Pending' });
    const sentToday = await Alert.countDocuments({
      status: 'Sent',
      date_sent: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
    const total = await Alert.countDocuments();
    res.json({ pending, sentToday, total });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching alert summary.', error: error.message });
  }
}

/**
 * GET /api/alerts/history/export
 * Returns the full alert history as a downloadable CSV, for record
 * keeping/reporting outside the application (e.g. attaching to a
 * monthly operations report).
 */
async function exportAlertHistoryCsv(req, res) {
  try {
    const alerts = await Alert.find()
      .populate('related_item_id', 'item_name sku_code')
      .populate('related_asset_id', 'asset_tag_no asset_name')
      .sort({ date_generated: -1 });

    const escapeCsv = (value) => {
      const str = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const header = ['Alert Type', 'Related To', 'Message', 'Status', 'Date Generated', 'Date Sent', 'Send Attempts'];
    const rows = alerts.map((a) => {
      const relatedTo = a.related_item_id
        ? `${a.related_item_id.item_name} (${a.related_item_id.sku_code})`
        : a.related_asset_id
          ? `${a.related_asset_id.asset_name} (${a.related_asset_id.asset_tag_no})`
          : '';
      return [
        a.alert_type,
        relatedTo,
        a.message,
        a.status,
        a.date_generated ? new Date(a.date_generated).toISOString() : '',
        a.date_sent ? new Date(a.date_sent).toISOString() : '',
        a.send_attempts || 0,
      ].map(escapeCsv).join(',');
    });

    const csv = [header.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="alert_history.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Error exporting alert history.', error: error.message });
  }
}

// Prevents overlapping alert-check runs: if an external pinger (or the
// in-process cron) triggers a check while a previous run is still in
// progress - for example because a slow/stalled SMTP send is still being
// retried - the new request is told a check is already running instead
// of starting a second, overlapping run against the same data.
let alertCheckInProgress = false;

/**
 * POST /api/alerts/run-check
 * Triggers one full alert-checking cycle (low-stock and asset review
 * checks), the same logic normally triggered by the scheduled cron job.
 * Intended to be called by an external uptime/cron pinger (e.g.
 * cron-job.org) so that alert checks are not missed if the in-process
 * node-cron timer happens to fire while the server is asleep on
 * free-tier hosting. Protected by a shared secret rather than a user
 * JWT, since external pingers cannot log in as a user.
 *
 * Responds immediately once the check has been started (or if one is
 * already running), rather than waiting for the entire check - including
 * every email send - to finish. This keeps the endpoint fast and
 * prevents a slow/stalled SMTP connection from causing the external
 * pinger's request to time out.
 */
async function triggerAlertCheck(req, res) {
  const providedKey = req.headers['x-alert-key'] || req.query.key;
  const expectedKey = process.env.ALERT_TRIGGER_KEY;

  if (!expectedKey) {
    return res.status(503).json({ message: 'Alert trigger endpoint is not configured (ALERT_TRIGGER_KEY missing).' });
  }
  if (providedKey !== expectedKey) {
    return res.status(401).json({ message: 'Invalid or missing alert trigger key.' });
  }

  if (alertCheckInProgress) {
    return res.status(202).json({ message: 'An alert check is already in progress; skipping this trigger.' });
  }

  alertCheckInProgress = true;
  res.status(202).json({ message: 'Alert check started.', timestamp: new Date().toISOString() });

  try {
    await runAlertCheckNow();
  } catch (error) {
    console.error('Error running triggered alert check:', error.message);
  } finally {
    alertCheckInProgress = false;
  }
}

module.exports = {
  listAlerts, alertSummary, triggerAlertCheck, exportAlertHistoryCsv,
};
