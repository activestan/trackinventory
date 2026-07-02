const InventoryItem = require('../models/InventoryItem');
const Asset = require('../models/Asset');
const Alert = require('../models/Alert');
const StockTransaction = require('../models/StockTransaction');

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
 * GET /api/reports/stock-by-category
 * Provides aggregate stock quantities grouped by category, used for the
 * "Stock Levels by Category" chart on the dashboard.
 */
async function stockByCategory(req, res) {
  try {
    const results = await InventoryItem.aggregate([
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
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Error generating category report.', error: error.message });
  }
}

module.exports = { dashboardSummary, stockByCategory };
