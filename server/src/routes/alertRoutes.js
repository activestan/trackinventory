const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { listAlerts, alertSummary, triggerAlertCheck } = require('../controllers/alertController');

router.get('/', authenticate, listAlerts);
router.get('/summary', authenticate, alertSummary);

// Allows an external scheduler (e.g. cron-job.org) or an authenticated
// Administrator to trigger an immediate alert check. This is more
// reliable than relying solely on the in-process node-cron timer on
// free-tier hosting platforms, where the server process can be put to
// sleep and miss a scheduled tick entirely.
router.post('/run-check', triggerAlertCheck);

module.exports = router;
