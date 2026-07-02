const mongoose = require('mongoose');

const AssetMovementLogSchema = new mongoose.Schema(
  {
    asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    from_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    movement_date: { type: Date, default: Date.now },
    condition_note: { type: String, trim: true, default: '' },
    status_at_movement: { type: String, trim: true, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('AssetMovementLog', AssetMovementLogSchema);
