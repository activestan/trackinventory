const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema(
  {
    asset_tag_no: { type: String, required: true, unique: true, trim: true },
    asset_name: { type: String, required: true, trim: true },
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    serial_number: { type: String, trim: true, default: '' },
    purchase_date: { type: Date },
    purchase_value: { type: Number, default: 0, min: 0 },
    current_status: {
      type: String,
      enum: ['Available', 'In Use', 'Under Repair', 'Retired'],
      default: 'Available',
    },
    current_custodian_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    location: { type: String, trim: true, default: '' },
    warranty_expiry: { type: Date },
    review_due_date: { type: Date }, // date after which the asset should be flagged for review/alert
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Asset', AssetSchema);
