const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  dashboardSummary, stockByCategory, exportStockByCategoryCsv, exportDashboardPdf,
} = require('../controllers/reportController');

router.get('/dashboard', authenticate, dashboardSummary);
router.get('/dashboard/export', authenticate, exportDashboardPdf);
router.get('/stock-by-category', authenticate, stockByCategory);
router.get('/stock-by-category/export', authenticate, exportStockByCategoryCsv);

module.exports = router;
