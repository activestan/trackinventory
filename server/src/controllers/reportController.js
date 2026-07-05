const PDFDocument = require('pdfkit');
const InventoryItem = require('../models/InventoryItem');
const Asset = require('../models/Asset');
const Alert = require('../models/Alert');
const StockTransaction = require('../models/StockTransaction');
const { sendCsv } = require('../utils/csvHelper');

/**
 * GET /api/reports/dashboard
 * Aggregates the key indicators shown on the role-based dashboard:
 * total stock items, low-stock item count, total assets, and pending
 * alert count - directly supporting the "Generate Reports" use case.
 */
async function dashboardSummary(req, res) {
  try {
    const totalItems = await InventoryItem.countDocuments();
    const totalAssets = await Asset.countDocuments();
    const pendingAlerts = await Alert.countDocuments({ status: 'Pending' });

    // Low stock items: quantity_on_hand <= reorder_level
    const lowStockItems = await InventoryItem.countDocuments({
      $expr: { $lte: ['$quantity_on_hand', '$reorder_level'] },
    });

    const recentTransactions = await StockTransaction.find()
      .populate('item_id', 'item_name')
      .populate('user_id', 'full_name')
      .sort({ transaction_date: -1 })
      .limit(5);

    res.json({
      totalItems,
      lowStockItems,
      totalAssets,
      pendingAlerts,
      recentTransactions,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating dashboard summary.', error: error.message });
  }
}

/**
 * Shared aggregation used by both the JSON dashboard chart endpoint and
 * the CSV export, so the two can never drift out of sync with each
 * other.
 */
async function getStockByCategoryData() {
  return InventoryItem.aggregate([
    {
      $lookup: {
        from: 'categories',
        localField: 'category_id',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: '$category' },
    {
      $group: {
        _id: '$category.category_name',
        totalQuantity: { $sum: '$quantity_on_hand' },
        itemCount: { $sum: 1 },
      },
    },
    { $sort: { totalQuantity: -1 } },
  ]);
}

/**
 * GET /api/reports/stock-by-category
 * Provides aggregate stock quantities grouped by category, used for the
 * "Stock Levels by Category" chart on the dashboard.
 */
async function stockByCategory(req, res) {
  try {
    const results = await getStockByCategoryData();
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Error generating category report.', error: error.message });
  }
}

/**
 * GET /api/reports/stock-by-category/export
 * Downloads the same stock-by-category data as a CSV file, for use in
 * spreadsheets or as an attachment to an operations report.
 */
async function exportStockByCategoryCsv(req, res) {
  try {
    const results = await getStockByCategoryData();
    const rows = results.map((r) => [r._id || 'Uncategorized', r.itemCount, r.totalQuantity]);
    sendCsv(res, 'stock_by_category.csv', ['Category', 'Item Count', 'Total Quantity On Hand'], rows);
  } catch (error) {
    res.status(500).json({ message: 'Error exporting category report.', error: error.message });
  }
}

/**
 * GET /api/reports/dashboard/export
 * Downloads a one-page PDF snapshot of the dashboard's key indicators
 * and stock-by-category breakdown, giving staff a simple document they
 * can print or attach to an email/report without needing to take a
 * screenshot of the live dashboard.
 */
async function exportDashboardPdf(req, res) {
  try {
    const [totalItems, totalAssets, pendingAlerts, lowStockItems, categoryData] = await Promise.all([
      InventoryItem.countDocuments(),
      Asset.countDocuments(),
      Alert.countDocuments({ status: 'Pending' }),
      InventoryItem.countDocuments({ $expr: { $lte: ['$quantity_on_hand', '$reorder_level'] } }),
      getStockByCategoryData(),
    ]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="dashboard_summary.pdf"');

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(18).text('Inventory & Asset Tracking System', { align: 'center' });
    doc.fontSize(12).fillColor('#555').text('Dashboard Summary Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#888').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fillColor('#000').fontSize(13).text('Key Indicators', { underline: true });
    doc.moveDown(0.5);
    const stats = [
      ['Total Stock Items', totalItems],
      ['Low Stock Items', lowStockItems],
      ['Total Assets', totalAssets],
      ['Pending Alerts', pendingAlerts],
    ];
    stats.forEach(([label, value]) => {
      doc.fontSize(11).text(`${label}: `, { continued: true }).font('Helvetica-Bold').text(String(value)).font('Helvetica');
    });

    doc.moveDown(1.5);
    doc.fontSize(13).text('Stock Levels by Category', { underline: true });
    doc.moveDown(0.5);

    if (categoryData.length === 0) {
      doc.fontSize(11).fillColor('#666').text('No inventory data available.');
    } else {
      const tableTop = doc.y;
      const col1 = 50; const col2 = 280; const col3 = 400;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Category', col1, tableTop);
      doc.text('Item Count', col2, tableTop);
      doc.text('Total Quantity', col3, tableTop);
      doc.font('Helvetica');
      let y = tableTop + 18;
      categoryData.forEach((row) => {
        doc.text(row._id || 'Uncategorized', col1, y);
        doc.text(String(row.itemCount), col2, y);
        doc.text(String(row.totalQuantity), col3, y);
        y += 18;
      });
    }

    doc.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating dashboard PDF.', error: error.message });
    } else {
      res.end();
    }
  }
}

module.exports = {
  dashboardSummary, stockByCategory, exportStockByCategoryCsv, exportDashboardPdf,
};
