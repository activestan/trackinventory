const User = require('../models/User');

// GET /api/users - list all users (Administrator only)
async function listUsers(req, res) {
  try {
    const users = await User.find().sort({ created_at: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users.', error: error.message });
  }
}

// POST /api/users - create a new user account (Administrator only)
async function createUser(req, res) {
  try {
    const { full_name, email, password, role, department } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ message: 'full_name, email, password and role are required.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const user = await User.create({
      full_name,
      email: email.toLowerCase(),
      password_hash: password, // hashed automatically by the pre-save hook
      role,
      department,
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error creating user.', error: error.message });
  }
}

/**
 * PUT /api/users/:id
 * Updates a user's profile fields, including their email address. Email
 * changes are validated for uniqueness just as at creation time. An
 * Administrator is prevented from demoting or deactivating themselves if
 * doing so would leave the system with no remaining active
 * Administrator, since that would permanently lock everyone out of
 * user-management and role-restricted functionality.
 */
async function updateUser(req, res) {
  try {
    const { full_name, email, role, department, is_active } = req.body;
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });

    if (email && email.toLowerCase() !== targetUser.email) {
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: targetUser._id } });
      if (existing) {
        return res.status(409).json({ message: 'Another user with this email already exists.' });
      }
      targetUser.email = email.toLowerCase();
    }

    const willRemainAdmin = (role || targetUser.role) === 'Administrator' && (is_active === undefined ? targetUser.is_active : is_active);
    const wasAdmin = targetUser.role === 'Administrator' && targetUser.is_active;

    if (wasAdmin && !willRemainAdmin) {
      const otherActiveAdmins = await User.countDocuments({
        role: 'Administrator',
        is_active: true,
        _id: { $ne: targetUser._id },
      });
      if (otherActiveAdmins === 0) {
        return res.status(400).json({ message: 'Cannot change this user: at least one active Administrator account must remain.' });
      }
    }

    if (full_name !== undefined) targetUser.full_name = full_name;
    if (role !== undefined) targetUser.role = role;
    if (department !== undefined) targetUser.department = department;
    if (is_active !== undefined) targetUser.is_active = is_active;

    await targetUser.save();
    res.json(targetUser);
  } catch (error) {
    res.status(500).json({ message: 'Error updating user.', error: error.message });
  }
}

// PUT /api/users/:id/deactivate - deactivate (soft-delete) a user, preserving their history
async function deactivateUser(req, res) {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });

    if (targetUser.role === 'Administrator' && targetUser.is_active) {
      const otherActiveAdmins = await User.countDocuments({
        role: 'Administrator',
        is_active: true,
        _id: { $ne: targetUser._id },
      });
      if (otherActiveAdmins === 0) {
        return res.status(400).json({ message: 'Cannot deactivate the only remaining active Administrator account.' });
      }
    }

    targetUser.is_active = false;
    await targetUser.save();
    res.json({ message: 'User deactivated.', user: targetUser });
  } catch (error) {
    res.status(500).json({ message: 'Error deactivating user.', error: error.message });
  }
}

/**
 * DELETE /api/users/:id
 * Permanently removes a user's account record. This is distinct from
 * deactivation: a deleted user's past stock transactions and asset
 * movement log entries remain in the database (as required for audit
 * purposes) but can no longer resolve to a name, since the referenced
 * user document no longer exists. Prevented for the last remaining
 * active Administrator, and for a user attempting to delete their own
 * account, to avoid accidental total lockout.
 */
async function deleteUser(req, res) {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });

    if (String(targetUser._id) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot delete your own account while logged in as it.' });
    }

    if (targetUser.role === 'Administrator' && targetUser.is_active) {
      const otherActiveAdmins = await User.countDocuments({
        role: 'Administrator',
        is_active: true,
        _id: { $ne: targetUser._id },
      });
      if (otherActiveAdmins === 0) {
        return res.status(400).json({ message: 'Cannot delete the only remaining active Administrator account.' });
      }
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User permanently deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user.', error: error.message });
  }
}

module.exports = { listUsers, createUser, updateUser, deactivateUser, deleteUser };
