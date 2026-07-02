const Alert = require('../models/Alert');

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

module.exports = { listAlerts, alertSummary };
