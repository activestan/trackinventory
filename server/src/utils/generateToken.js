const jwt = require('jsonwebtoken');

/**
 * Generates a signed JSON Web Token for a given user, embedding the
 * user's id and role so that role-based access checks can be performed
 * without an additional database lookup on every request.
 */
function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

module.exports = generateToken;
