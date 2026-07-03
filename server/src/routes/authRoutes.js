const express = require('express');
const router = express.Router();
const {
  login, getProfile, changePassword, forgotPassword, resetPassword,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { loginLimiter, passwordResetRequestLimiter } = require('../middleware/rateLimiters');

router.post('/login', loginLimiter, login);
router.get('/me', authenticate, getProfile);
router.put('/change-password', authenticate, changePassword);
router.post('/forgot-password', passwordResetRequestLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
