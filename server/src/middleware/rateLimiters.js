const rateLimit = require('express-rate-limit');

/**
 * Restricts repeated login attempts from the same IP address, to slow
 * down credential brute-forcing. A generous limit is used so that a
 * legitimate user who mistypes their password a few times is not
 * locked out, while still meaningfully throttling automated attacks.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts from this device. Please wait 15 minutes and try again.' },
});

/**
 * Restricts repeated password-reset requests from the same IP address,
 * to prevent abuse of the email-sending endpoint (e.g. an attacker
 * repeatedly requesting resets for many email addresses to spam
 * recipients or exhaust the free email-sending quota).
 */
const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 reset requests per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many password reset requests from this device. Please wait an hour and try again.' },
});

module.exports = { loginLimiter, passwordResetRequestLimiter };
