const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listItems, getItem, createItem, updateItem, deleteItem,
  recordTransaction, listItemTransactions, listRecentTransactions,
} = require('../controllers/inventoryController');

router.use(authenticate);

router.get('/transactions/recent', listRecentTransactions);

router.get('/', listItems);
router.post('/', authorize('Administrator', 'Store Officer'), createItem);
router.get('/:id', getItem);
router.put('/:id', authorize('Administrator', 'Store Officer'), updateItem);
router.delete('/:id', authorize('Administrator'), deleteItem);

router.post('/:id/transactions', authorize('Administrator', 'Store Officer'), recordTransaction);
router.get('/:id/transactions', listItemTransactions);

module.exports = router;
