const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema(
  {
    supplier_name: { type: String, required: true, trim: true },
    contact_person: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Supplier', SupplierSchema);
