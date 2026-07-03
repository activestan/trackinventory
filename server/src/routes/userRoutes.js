const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listUsers, createUser, updateUser, deactivateUser, deleteUser,
} = require('../controllers/userController');

// All user-management routes require the Administrator role.
router.use(authenticate, authorize('Administrator'));

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.put('/:id/deactivate', deactivateUser);
router.delete('/:id', deleteUser);

module.exports = router;
