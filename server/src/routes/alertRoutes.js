const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { listAlerts, alertSummary } = require('../controllers/alertController');

router.get('/', authenticate, listAlerts);
router.get('/summary', authenticate, alertSummary);

module.exports = router;
