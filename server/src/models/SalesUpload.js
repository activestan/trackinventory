const mongoose = require('mongoose');

/**
 * Records the outcome of a single row within an uploaded sales file, so
 * that a manager can review exactly which rows succeeded and which
 * failed (and why) after uploading a day's sales.
 */
const SalesUploadRowResultSchema = new mongoose.Schema(
  {
    row_number: { type: Number, required: true },
    sku_code: { type: String, required: true },
    quantity: { type: Number },
    status: { type: String, enum: ['Success', 'Failed'], required: true },
    message: { type: String, default: '' },
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
    transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction', default: null },
  },
  { _id: false }
);

/**
 * Represents one batch upload of a daily sales file by a Manager or
 * Administrator. Each valid row in the file is converted into a
 * Stock-Out StockTransaction against the matching inventory item (by
 * SKU code), automatically reducing quantity_on_hand exactly as a
 * manually recorded Stock-Out transaction would.
 */
const SalesUploadSchema = new mongoose.Schema(
  {
    uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    original_filename: { type: String, required: true },
    sale_date: { type: Date, default: Date.now },
    total_rows: { type: Number, default: 0 },
    success_count: { type: Number, default: 0 },
    failure_count: { type: Number, default: 0 },
    row_results: { type: [SalesUploadRowResultSchema], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('SalesUpload', SalesUploadSchema);
