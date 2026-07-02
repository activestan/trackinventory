const mongoose = require('mongoose');

const StockTransactionSchema = new mongoose.Schema(
  {
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transaction_type: { type: String, enum: ['Stock-In', 'Stock-Out'], required: true },
    quantity: { type: Number, required: true, min: 1 },
    transaction_date: { type: Date, default: Date.now },
    remarks: { type: String, trim: true, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('StockTransaction', StockTransactionSchema);
