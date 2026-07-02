const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema(
  {
    alert_type: {
      type: String,
      enum: ['Low-Stock', 'Asset-Overdue', 'Asset-Review'],
      required: true,
    },
    related_item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
    related_asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', default: null },
    message: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Sent', 'Failed'], default: 'Pending' },
    date_generated: { type: Date, default: Date.now },
    date_sent: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Alert', AlertSchema);
