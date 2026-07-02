const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listSuppliers, createSupplier, updateSupplier, deleteSupplier,
} = require('../controllers/supplierController');

router.get('/', authenticate, listSuppliers);
router.post('/', authenticate, authorize('Administrator', 'Store Officer'), createSupplier);
router.put('/:id', authenticate, authorize('Administrator', 'Store Officer'), updateSupplier);
router.delete('/:id', authenticate, authorize('Administrator'), deleteSupplier);

module.exports = router;
