const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listAlerts, alertSummary, triggerAlertCheck, exportAlertHistoryCsv,
} = require('../controllers/alertController');
const { getSettings, updateSettings } = require('../controllers/alertSettingsController');

router.get('/', authenticate, listAlerts);
router.get('/summary', authenticate, alertSummary);
router.get('/history/export', authenticate, exportAlertHistoryCsv);

// Alert Settings: lets an Administrator adjust the alert engine's
// cooldown/retry timing from the UI instead of Render environment
// variables (which require a redeploy to change). Read access is open
// to any authenticated user so non-admin roles can also see how the
// cooldown behaviour is currently configured; only Administrators may
// change it.
router.get('/settings', authenticate, getSettings);
router.put('/settings', authenticate, authorize('Administrator'), updateSettings);

// Allows an external scheduler (e.g. cron-job.org) or an authenticated
// Administrator to trigger an immediate alert check. This is more
// reliable than relying solely on the in-process node-cron timer on
// free-tier hosting platforms, where the server process can be put to
// sleep and miss a scheduled tick entirely.
router.post('/run-check', triggerAlertCheck);

module.exports = router;
