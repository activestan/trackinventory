const Alert = require('../models/Alert');
const { runAlertCheckNow } = require('../jobs/alertScheduler');

// GET /api/alerts - list all alerts (most recent first)
async function listAlerts(req, res) {
  try {
    const { status, alert_type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (alert_type) filter.alert_type = alert_type;

    const alerts = await Alert.find(filter)
      .populate('related_item_id', 'item_name sku_code quantity_on_hand reorder_level')
      .populate('related_asset_id', 'asset_tag_no asset_name')
      .sort({ date_generated: -1 });

    res.json(alerts);
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
 * POST /api/alerts/run-check
 * Immediately runs one full alert-checking cycle (low-stock and asset
 * review checks), the same logic normally triggered by the scheduled
 * cron job. Intended to be called by an external uptime/cron pinger
 * (e.g. cron-job.org) so that alert checks are not missed if the
 * in-process node-cron timer happens to fire while the server is asleep
 * on free-tier hosting. Protected by a shared secret rather than a user
 * JWT, since external pingers cannot log in as a user.
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

  try {
    await runAlertCheckNow();
    res.json({ message: 'Alert check completed.', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ message: 'Error running alert check.', error: error.message });
  }
}

module.exports = { listAlerts, alertSummary, triggerAlertCheck };
