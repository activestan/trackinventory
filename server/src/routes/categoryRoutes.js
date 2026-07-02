const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listCategories, createCategory, updateCategory, deleteCategory,
} = require('../controllers/categoryController');

router.get('/', authenticate, listCategories);
router.post('/', authenticate, authorize('Administrator'), createCategory);
router.put('/:id', authenticate, authorize('Administrator'), updateCategory);
router.delete('/:id', authenticate, authorize('Administrator'), deleteCategory);

module.exports = router;
