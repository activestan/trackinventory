const User = require('../models/User');
const generateToken = require('../utils/generateToken');

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

module.exports = { login, getProfile, changePassword };
