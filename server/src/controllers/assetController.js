const Asset = require('../models/Asset');
const AssetMovementLog = require('../models/AssetMovementLog');

// GET /api/assets - list all assets
async function listAssets(req, res) {
  try {
    const assets = await Asset.find()
      .populate('category_id', 'category_name')
      .populate('current_custodian_id', 'full_name department')
      .sort({ asset_name: 1 });
    res.json(assets);
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
 * logging the change in the AssetMovementLog (Objective 2).
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
