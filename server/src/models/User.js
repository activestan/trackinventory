const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    role: {
      type: String,
      enum: ['Administrator', 'Store Officer', 'Asset Custodian', 'Manager'],
      required: true,
    },
    department: { type: String, trim: true, default: '' },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Hash the password automatically whenever it is set or changed.
UserSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password_hash')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password_hash = await bcrypt.hash(this.password_hash, salt);
  next();
});

UserSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password_hash);
};

// Never expose the password hash when a user document is converted to JSON.
UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password_hash;
    return ret;
  },
});

module.exports = mongoose.model('User', UserSchema);
