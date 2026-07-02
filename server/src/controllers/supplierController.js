const Supplier = require('../models/Supplier');

async function listSuppliers(req, res) {
  try {
    const suppliers = await Supplier.find().sort({ supplier_name: 1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching suppliers.', error: error.message });
  }
}

async function createSupplier(req, res) {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ message: 'Error creating supplier.', error: error.message });
  }
}

async function updateSupplier(req, res) {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found.' });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: 'Error updating supplier.', error: error.message });
  }
}

async function deleteSupplier(req, res) {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found.' });
    res.json({ message: 'Supplier deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting supplier.', error: error.message });
  }
}

module.exports = { listSuppliers, createSupplier, updateSupplier, deleteSupplier };
