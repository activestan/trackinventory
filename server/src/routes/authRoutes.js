const express = require('express');
const router = express.Router();
const { login, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', authenticate, getProfile);

module.exports = router;
