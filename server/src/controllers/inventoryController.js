const InventoryItem = require('../models/InventoryItem');
const StockTransaction = require('../models/StockTransaction');

// GET /api/inventory - list all inventory items (with category/supplier populated)
async function listItems(req, res) {
  try {
    const items = await InventoryItem.find()
      .populate('category_id', 'category_name')
      .populate('supplier_id', 'supplier_name')
      .sort({ item_name: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory items.', error: error.message });
  }
}

// GET /api/inventory/:id
async function getItem(req, res) {
  try {
    const item = await InventoryItem.findById(req.params.id)
      .populate('category_id', 'category_name')
      .populate('supplier_id', 'supplier_name');
    if (!item) return res.status(404).json({ message: 'Inventory item not found.' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory item.', error: error.message });
  }
}

// POST /api/inventory - create a new inventory item
async function createItem(req, res) {
  try {
    const {
      item_name, category_id, sku_code, unit_of_measure,
      quantity_on_hand, reorder_level, unit_cost, supplier_id,
    } = req.body;

    if (!item_name || !category_id || !sku_code) {
      return res.status(400).json({ message: 'item_name, category_id and sku_code are required.' });
    }

    const item = await InventoryItem.create({
      item_name, category_id, sku_code, unit_of_measure,
      quantity_on_hand: quantity_on_hand || 0,
      reorder_level: reorder_level || 5,
      unit_cost: unit_cost || 0,
      supplier_id: supplier_id || undefined,
    });

    res.status(201).json(item);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An item with this SKU code already exists.' });
    }
    res.status(500).json({ message: 'Error creating inventory item.', error: error.message });
  }
}

// PUT /api/inventory/:id - update item details (not quantity - use transactions for that)
async function updateItem(req, res) {
  try {
    const { item_name, category_id, unit_of_measure, reorder_level, unit_cost, supplier_id } = req.body;
    const item = await InventoryItem.findByIdAndUpdate(
      req.params.id,
      { item_name, category_id, unit_of_measure, reorder_level, unit_cost, supplier_id },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ message: 'Inventory item not found.' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error updating inventory item.', error: error.message });
  }
}

// DELETE /api/inventory/:id
async function deleteItem(req, res) {
  try {
    const item = await InventoryItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Inventory item not found.' });
    res.json({ message: 'Inventory item deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting inventory item.', error: error.message });
  }
}

/**
 * POST /api/inventory/:id/transactions
 * Records a Stock-In or Stock-Out transaction against an inventory item
 * and automatically recalculates quantity_on_hand, implementing the
 * core logic of Objective 1 (centralized inventory tracking).
 */
async function recordTransaction(req, res) {
  try {
    const { transaction_type, quantity, remarks } = req.body;
    const item = await InventoryItem.findById(req.params.id);

    if (!item) return res.status(404).json({ message: 'Inventory item not found.' });
    if (!['Stock-In', 'Stock-Out'].includes(transaction_type)) {
      return res.status(400).json({ message: 'transaction_type must be Stock-In or Stock-Out.' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'quantity must be a positive number.' });
    }

    if (transaction_type === 'Stock-Out' && quantity > item.quantity_on_hand) {
      return res.status(400).json({
        message: `Cannot remove ${quantity} units; only ${item.quantity_on_hand} units are currently in stock.`,
      });
    }

    // Update the quantity on hand.
    item.quantity_on_hand =
      transaction_type === 'Stock-In'
        ? item.quantity_on_hand + quantity
        : item.quantity_on_hand - quantity;
    await item.save();

    // Record the transaction for audit/history purposes.
    const transaction = await StockTransaction.create({
      item_id: item._id,
      user_id: req.user.id,
      transaction_type,
      quantity,
      remarks,
    });

    res.status(201).json({ item, transaction });
  } catch (error) {
    res.status(500).json({ message: 'Error recording stock transaction.', error: error.message });
  }
}

// GET /api/inventory/:id/transactions - transaction history for one item
async function listItemTransactions(req, res) {
  try {
    const transactions = await StockTransaction.find({ item_id: req.params.id })
      .populate('user_id', 'full_name')
      .sort({ transaction_date: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions.', error: error.message });
  }
}

// GET /api/inventory/transactions/recent - most recent transactions across all items (dashboard)
async function listRecentTransactions(req, res) {
  try {
    const limit = Number(req.query.limit) || 10;
    const transactions = await StockTransaction.find()
      .populate('item_id', 'item_name sku_code')
      .populate('user_id', 'full_name')
      .sort({ transaction_date: -1 })
      .limit(limit);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recent transactions.', error: error.message });
  }
}

module.exports = {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  recordTransaction,
  listItemTransactions,
  listRecentTransactions,
};
