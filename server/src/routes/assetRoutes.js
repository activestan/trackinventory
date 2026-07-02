const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listAssets, getAsset, createAsset, updateAsset,
  transferAsset, updateAssetStatus, getAssetHistory, deleteAsset,
} = require('../controllers/assetController');

router.use(authenticate);

router.get('/', listAssets);
router.post('/', authorize('Administrator', 'Asset Custodian'), createAsset);
router.get('/:id', getAsset);
router.put('/:id', authorize('Administrator', 'Asset Custodian'), updateAsset);
router.delete('/:id', authorize('Administrator'), deleteAsset);

router.post('/:id/transfer', authorize('Administrator', 'Asset Custodian'), transferAsset);
router.put('/:id/status', authorize('Administrator', 'Asset Custodian'), updateAssetStatus);
router.get('/:id/history', getAssetHistory);

module.exports = router;
