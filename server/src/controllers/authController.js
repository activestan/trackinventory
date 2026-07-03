const crypto = require('crypto');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendMail = require('../utils/mailer');

// Password reset links are valid for this long after being requested.
const RESET_TOKEN_EXPIRY_MINUTES = 30;

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * POST /api/auth/login
 * Authenticates a user by email and password and returns a JWT together
 * with basic profile information, used by the front end to route the
 * user to the correct role-based dashboard.
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
}

/**
 * GET /api/auth/me
 * Returns the profile of the currently authenticated user.
 */
async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving profile.', error: error.message });
  }
}

/**
 * PUT /api/auth/change-password
 * Allows the currently authenticated user to change their own password,
 * after verifying their existing (current) password for security.
 */
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'current_password and new_password are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    user.password_hash = new_password; // re-hashed automatically by the pre-save hook
    await user.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error changing password.', error: error.message });
  }
}

/**
 * POST /api/auth/forgot-password
 * Initiates a password reset for the given email address. A random,
 * single-use token is generated, its SHA-256 hash is stored on the
 * user's record (the raw token itself is never persisted, mirroring how
 * passwords are never stored in plain text), and a reset link containing
 * the raw token is emailed to the address. To avoid revealing which
 * email addresses have an account (a common account-enumeration
 * vulnerability), the endpoint always returns the same success message
 * regardless of whether the address matches an existing, active user.
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const genericResponse = {
      message: 'If an account exists for that email address, a password reset link has been sent to it.',
    };

    const user = await User.findOne({ email: email.toLowerCase(), is_active: true });
    if (!user) {
      return res.json(genericResponse); // do not reveal whether the account exists
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.password_reset_token_hash = hashToken(rawToken);
    user.password_reset_expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.CLIENT_ORIGIN}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    try {
      await sendMail({
        to: user.email,
        subject: 'Password Reset Request - Inventory & Asset Tracking System',
        text: `A password reset was requested for your account. This link is valid for ${RESET_TOKEN_EXPIRY_MINUTES} minutes: ${resetUrl}\n\nIf you did not request this, you can safely ignore this email; your password will remain unchanged.`,
        html: `<p>A password reset was requested for your account.</p><p><a href="${resetUrl}">Click here to reset your password</a> (valid for ${RESET_TOKEN_EXPIRY_MINUTES} minutes).</p><p>If you did not request this, you can safely ignore this email; your password will remain unchanged.</p>`,
      });
    } catch (mailError) {
      console.error('Failed to send password reset email:', mailError.message);
      // Intentionally still return the generic success response: we do
      // not want to leak email-delivery failures to an unauthenticated
      // caller, as that itself could confirm the account's existence.
    }

    res.json(genericResponse);
  } catch (error) {
    res.status(500).json({ message: 'Server error processing password reset request.', error: error.message });
  }
}

/**
 * POST /api/auth/reset-password
 * Completes a password reset given a valid, unexpired token (as
 * generated by forgotPassword) and sets the account's new password.
 */
async function resetPassword(req, res) {
  try {
    const { email, token, new_password } = req.body;

    if (!email || !token || !new_password) {
      return res.status(400).json({ message: 'email, token and new_password are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      is_active: true,
      password_reset_token_hash: hashToken(token),
      password_reset_expires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'This password reset link is invalid or has expired. Please request a new one.' });
    }

    user.password_hash = new_password; // re-hashed automatically by the pre-save hook
    user.password_reset_token_hash = null;
    user.password_reset_expires = null;
    await user.save();

    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error resetting password.', error: error.message });
  }
}

module.exports = {
  login, getProfile, changePassword, forgotPassword, resetPassword,
};
