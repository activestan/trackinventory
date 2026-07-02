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

// PUT /api/users/:id - update a user's role/department/active status
async function updateUser(req, res) {
  try {
    const { full_name, role, department, is_active } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { full_name, role, department, is_active },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error updating user.', error: error.message });
  }
}

// DELETE /api/users/:id - deactivate (soft-delete) a user
async function deactivateUser(req, res) {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'User deactivated.', user });
  } catch (error) {
    res.status(500).json({ message: 'Error deactivating user.', error: error.message });
  }
}

module.exports = { listUsers, createUser, updateUser, deactivateUser };
