const mongoose = require('mongoose');

const InventoryItemSchema = new mongoose.Schema(
  {
    item_name: { type: String, required: true, trim: true },
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    sku_code: { type: String, required: true, unique: true, trim: true },
    unit_of_measure: { type: String, default: 'piece', trim: true },
    quantity_on_hand: { type: Number, required: true, default: 0, min: 0 },
    reorder_level: { type: Number, required: true, default: 5, min: 0 },
    unit_cost: { type: Number, default: 0, min: 0 },
    supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    date_added: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Virtual flag used throughout the app and API responses to indicate
// whether this item currently requires a low-stock alert.
InventoryItemSchema.virtual('is_low_stock').get(function isLowStock() {
  return this.quantity_on_hand <= this.reorder_level;
});

InventoryItemSchema.set('toJSON', { virtuals: true });
InventoryItemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('InventoryItem', InventoryItemSchema);
