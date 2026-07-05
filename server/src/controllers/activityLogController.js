const StockTransaction = require('../models/StockTransaction');
const AssetMovementLog = require('../models/AssetMovementLog');

/**
 * GET /api/activity-log
 * Merges stock transactions (Stock-In/Stock-Out) and asset movement
 * logs (assignments/transfers/status changes) into a single
 * chronological feed, sorted most-recent-first. This gives staff one
 * place to see "everything that has happened" across both inventory
 * and asset operations, instead of having to check two separate pages
 * to reconstruct a timeline.
 *
 * Supports optional pagination via ?page & ?limit query params (both
 * default sensibly if omitted), since this feed can grow large over
 * time as more stock and asset activity is recorded.
 */
async function listActivityLog(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const [stockTransactions, assetMovements] = await Promise.all([
      StockTransaction.find()
        .populate('item_id', 'item_name sku_code')
        .populate('user_id', 'full_name')
        .sort({ transaction_date: -1 })
        .limit(2000), // safety cap against unbounded memory use; ample for this system's scale
      AssetMovementLog.find()
        .populate('asset_id', 'asset_name asset_tag_no')
        .populate('from_user_id', 'full_name')
        .populate('to_user_id', 'full_name')
        .sort({ movement_date: -1 })
        .limit(2000),
    ]);

    const stockEvents = stockTransactions.map((t) => ({
      id: `stock-${t._id}`,
      category: 'Stock Transaction',
      type: t.transaction_type,
      description: `${t.transaction_type} of ${t.quantity} unit(s) - ${t.item_id?.item_name || 'Unknown item'} (${t.item_id?.sku_code || '—'})`,
      performed_by: t.user_id?.full_name || 'Unknown user',
      remarks: t.remarks || '',
      date: t.transaction_date,
    }));

    const assetEvents = assetMovements.map((m) => ({
      id: `asset-${m._id}`,
      category: 'Asset Movement',
      type: m.status_at_movement || 'Update',
      description: `${m.asset_id?.asset_name || 'Unknown asset'} (${m.asset_id?.asset_tag_no || '—'}) - ${
        m.to_user_id ? `assigned to ${m.to_user_id.full_name}` : 'unassigned'
      }${m.from_user_id ? `, previously with ${m.from_user_id.full_name}` : ''}, status: ${m.status_at_movement || 'N/A'}`,
      performed_by: m.to_user_id?.full_name || m.from_user_id?.full_name || 'System',
      remarks: m.condition_note || '',
      date: m.movement_date,
    }));

    const merged = [...stockEvents, ...assetEvents].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const total = merged.length;
    const start = (page - 1) * limit;
    const pageItems = merged.slice(start, start + limit);

    res.json({
      items: pageItems,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching activity log.', error: error.message });
  }
}

module.exports = { listActivityLog };
