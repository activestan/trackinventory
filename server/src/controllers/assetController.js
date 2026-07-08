const Asset = require('../models/Asset');
const AssetMovementLog = require('../models/AssetMovementLog');
const User = require('../models/User');
const sendMail = require('../utils/mailer');

/**
 * Sends a direct, immediate notification email about a custodian change
 * for one asset. Unlike the Low-Stock/Asset-Review alerts, this is a
 * one-time event (not a recurring condition to be re-checked on a
 * schedule), so it deliberately does NOT go through the Alert
 * model/cooldown system - it is simply sent once, right when the
 * reassignment happens.
 *
 * Failure to send is logged but never blocks the actual reassignment:
 * an email provider hiccup should not prevent a legitimate custodian
 * change from being recorded.
 */
async function notifyCustodianChange({ asset, toUser, fromUser }) {
  const attempts = [];

  if (toUser?.email) {
    attempts.push(
      sendMail({
        to: toUser.email,
        subject: `Asset Assigned to You - ${asset.asset_name}`,
        text: `You have been assigned "${asset.asset_name}" (Tag ${asset.asset_tag_no}). Please confirm receipt and its condition with your Administrator if anything looks incorrect.`,
      })
    );
  }

  if (fromUser?.email) {
    attempts.push(
      sendMail({
        to: fromUser.email,
        subject: `Asset Reassigned From You - ${asset.asset_name}`,
        text: `"${asset.asset_name}" (Tag ${asset.asset_tag_no}) has been reassigned away from you and is no longer your responsibility.`,
      })
    );
  }

  const results = await Promise.allSettled(attempts);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('Failed to send asset custodian-change notification:', result.reason?.message || result.reason);
    }
  });
}

/**
 * Sends a direct, immediate notification when an asset is unassigned
 * (returned to "Available" with no custodian), informing the previous
 * custodian that it is no longer their responsibility.
 */
async function notifyCustodianUnassigned({ asset, fromUser }) {
  if (!fromUser?.email) return;
  try {
    await sendMail({
      to: fromUser.email,
      subject: `Asset Unassigned From You - ${asset.asset_name}`,
      text: `"${asset.asset_name}" (Tag ${asset.asset_tag_no}) has been unassigned from you and is no longer your responsibility.`,
    });
  } catch (error) {
    console.error('Failed to send asset unassignment notification:', error.message);
  }
}


/**
 * GET /api/assets - list assets, with optional search, category/status
 * filters, and pagination.
 *
 * Query params (all optional):
 *   search        - case-insensitive match against asset_name, asset_tag_no, or serial_number
 *   category_id   - restrict to a single category
 *   current_status - restrict to a single status (Available/In Use/Under Repair/Retired)
 *   page, limit   - pagination; response shape switches to
 *                   { items, page, limit, total, totalPages } only when
 *                   these are supplied, keeping the endpoint backward
 *                   compatible with existing callers that expect a bare
 *                   array.
 */
async function listAssets(req, res) {
  try {
    const { search, category_id, current_status, page, limit } = req.query;

    const filter = {};
    if (category_id) filter.category_id = category_id;
    if (current_status) filter.current_status = current_status;
    if (search) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ asset_name: regex }, { asset_tag_no: regex }, { serial_number: regex }];
    }

    const query = Asset.find(filter)
      .populate('category_id', 'category_name')
      .populate('current_custodian_id', 'full_name department')
      .sort({ asset_name: 1 });

    if (!page && !limit) {
      const assets = await query;
      return res.json(assets);
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 200);
    const total = await Asset.countDocuments(filter);

    const assets = await query.skip((pageNum - 1) * pageSize).limit(pageSize);

    res.json({
      items: assets,
      page: pageNum,
      limit: pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching assets.', error: error.message });
  }
}

// GET /api/assets/:id
async function getAsset(req, res) {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('category_id', 'category_name')
      .populate('current_custodian_id', 'full_name department');
    if (!asset) return res.status(404).json({ message: 'Asset not found.' });
    res.json(asset);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching asset.', error: error.message });
  }
}

/**
 * POST /api/assets
 * Registers a new asset. Implements the "Register/Tag New Asset" use
 * case from the Use Case Diagram (Objective 2).
 */
async function createAsset(req, res) {
  try {
    const {
      asset_tag_no, asset_name, category_id, serial_number,
      purchase_date, purchase_value, location, warranty_expiry,
      current_custodian_id, review_due_date,
    } = req.body;

    if (!asset_tag_no || !asset_name || !category_id) {
      return res.status(400).json({ message: 'asset_tag_no, asset_name and category_id are required.' });
    }

    const asset = await Asset.create({
      asset_tag_no, asset_name, category_id, serial_number,
      purchase_date, purchase_value, location, warranty_expiry, review_due_date,
      current_custodian_id: current_custodian_id || null,
      current_status: current_custodian_id ? 'In Use' : 'Available',
    });

    // Log the initial assignment, if any, in the movement history.
    if (current_custodian_id) {
      await AssetMovementLog.create({
        asset_id: asset._id,
        from_user_id: null,
        to_user_id: current_custodian_id,
        condition_note: 'Initial assignment at registration.',
        status_at_movement: asset.current_status,
      });
    }

    res.status(201).json(asset);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An asset with this tag number already exists.' });
    }
    res.status(500).json({ message: 'Error registering asset.', error: error.message });
  }
}

// PUT /api/assets/:id - update general asset details (not custodian - use /transfer for that)
async function updateAsset(req, res) {
  try {
    const { asset_name, category_id, serial_number, location, warranty_expiry, purchase_value, review_due_date } = req.body;
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { asset_name, category_id, serial_number, location, warranty_expiry, purchase_value, review_due_date },
      { new: true, runValidators: true }
    );
    if (!asset) return res.status(404).json({ message: 'Asset not found.' });
    res.json(asset);
  } catch (error) {
    res.status(500).json({ message: 'Error updating asset.', error: error.message });
  }
}

/**
 * POST /api/assets/:id/transfer
 * Assigns or transfers an asset to a new custodian, automatically
 * logging the change in the AssetMovementLog (Objective 2), and
 * emailing the affected user(s) directly and immediately:
 *   - Reassigned to someone: the new custodian is emailed ("assigned to
 *     you"), and if there was a previous custodian, they are also
 *     emailed ("reassigned from you").
 *   - Unassigned (to_user_id omitted/empty): the previous custodian, if
 *     any, is emailed ("unassigned from you").
 * These are immediate, one-time notifications, separate from the
 * scheduled Low-Stock/Asset-Review alert engine, since a custodian
 * change is a single event rather than a recurring condition to
 * re-check.
 */
async function transferAsset(req, res) {
  try {
    const { to_user_id, condition_note, location } = req.body;
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found.' });

    const fromUserId = asset.current_custodian_id;

    asset.current_custodian_id = to_user_id || null;
    asset.current_status = to_user_id ? 'In Use' : 'Available';
    if (location) asset.location = location;
    await asset.save();

    const log = await AssetMovementLog.create({
      asset_id: asset._id,
      from_user_id: fromUserId,
      to_user_id: to_user_id || null,
      condition_note: condition_note || '',
      status_at_movement: asset.current_status,
    });

    // Fire the notification email(s) without making the API response
    // wait for delivery to complete, so a slow/failing email provider
    // never delays or blocks the reassignment itself.
    const fromUser = fromUserId ? await User.findById(fromUserId).select('full_name email') : null;
    if (to_user_id) {
      const toUser = await User.findById(to_user_id).select('full_name email');
      notifyCustodianChange({ asset, toUser, fromUser }).catch(() => {});
    } else if (fromUser) {
      notifyCustodianUnassigned({ asset, fromUser }).catch(() => {});
    }

    res.json({ asset, log });
  } catch (error) {
    res.status(500).json({ message: 'Error transferring asset.', error: error.message });
  }
}

/**
 * PUT /api/assets/:id/status
 * Updates an asset's condition/status (e.g., marking it Under Repair or
 * Retired), logging the change in the movement history.
 */
async function updateAssetStatus(req, res) {
  try {
    const { current_status, condition_note } = req.body;
    const validStatuses = ['Available', 'In Use', 'Under Repair', 'Retired'];

    if (!validStatuses.includes(current_status)) {
      return res.status(400).json({ message: `current_status must be one of: ${validStatuses.join(', ')}` });
    }

    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found.' });

    asset.current_status = current_status;
    await asset.save();

    const log = await AssetMovementLog.create({
      asset_id: asset._id,
      from_user_id: asset.current_custodian_id,
      to_user_id: asset.current_custodian_id,
      condition_note: condition_note || '',
      status_at_movement: current_status,
    });

    res.json({ asset, log });
  } catch (error) {
    res.status(500).json({ message: 'Error updating asset status.', error: error.message });
  }
}

// GET /api/assets/:id/history - full movement/status history of one asset
async function getAssetHistory(req, res) {
  try {
    const history = await AssetMovementLog.find({ asset_id: req.params.id })
      .populate('from_user_id', 'full_name')
      .populate('to_user_id', 'full_name')
      .sort({ movement_date: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching asset history.', error: error.message });
  }
}

// DELETE /api/assets/:id
async function deleteAsset(req, res) {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found.' });
    res.json({ message: 'Asset deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting asset.', error: error.message });
  }
}

module.exports = {
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  transferAsset,
  updateAssetStatus,
  getAssetHistory,
  deleteAsset,
};
