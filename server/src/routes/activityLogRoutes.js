const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { listActivityLog } = require('../controllers/activityLogController');

router.get('/', authenticate, listActivityLog);

module.exports = router;
