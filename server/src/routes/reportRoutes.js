const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { dashboardSummary, stockByCategory } = require('../controllers/reportController');

router.get('/dashboard', authenticate, dashboardSummary);
router.get('/stock-by-category', authenticate, stockByCategory);

module.exports = router;
