import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import * as api from '../api/services';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [transactionItem, setTransactionItem] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const [itemsData, catData, supData] = await Promise.all([
        api.getInventoryItems(),
        api.getCategories(),
        api.getSuppliers(),
      ]);
      setItems(itemsData);
      setCategories(catData);
      setSuppliers(supData);
    } catch (err) {
      setError('Unable to load inventory data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AppLayout title="Inventory Management">
      <div className="page-toolbar">
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          + Add New Item
        </button>
      </div>

      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      {loading ? (
        <p>Loading inventory...</p>
      ) : (
        <div className="panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Qty on Hand</th>
                <th>Reorder Level</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{item.item_name}</td>
                  <td>{item.sku_code}</td>
                  <td>{item.category_id?.category_name || '—'}</td>
                  <td>{item.quantity_on_hand}</td>
                  <td>{item.reorder_level}</td>
                  <td>
                    <span className={`badge ${item.is_low_stock ? 'badge-red' : 'badge-green'}`}>
                      {item.is_low_stock ? 'Low Stock' : 'OK'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-link" onClick={() => setTransactionItem(item)}>
                      Stock In/Out
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">No inventory items yet. Add your first item above.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddItemModal
          categories={categories}
          suppliers={suppliers}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); loadData(); }}
        />
      )}

      {transactionItem && (
        <StockTransactionModal
          item={transactionItem}
          onClose={() => setTransactionItem(null)}
          onSaved={() => { setTransactionItem(null); loadData(); }}
        />
      )}
    </AppLayout>
  );
}

function AddItemModal({ categories, suppliers, onClose, onCreated }) {
  const [form, setForm] = useState({
    item_name: '', category_id: '', sku_code: '', unit_of_measure: 'piece',
    quantity_on_hand: 0, reorder_level: 5, unit_cost: 0, supplier_id: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createInventoryItem(form);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating item.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add New Stock Item" onClose={onClose}>
      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Item Name
          <input required value={form.item_name} onChange={(e) => updateField('item_name', e.target.value)} />
        </label>
        <label>
          Category
          <select required value={form.category_id} onChange={(e) => updateField('category_id', e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.category_name}</option>)}
          </select>
        </label>
        <label>
          SKU Code
          <input required value={form.sku_code} onChange={(e) => updateField('sku_code', e.target.value)} />
        </label>
        <label>
          Unit of Measure
          <input value={form.unit_of_measure} onChange={(e) => updateField('unit_of_measure', e.target.value)} />
        </label>
        <label>
          Quantity on Hand
          <input type="number" min="0" value={form.quantity_on_hand} onChange={(e) => updateField('quantity_on_hand', Number(e.target.value))} />
        </label>
        <label>
          Reorder Level
          <input type="number" min="0" value={form.reorder_level} onChange={(e) => updateField('reorder_level', Number(e.target.value))} />
        </label>
        <label>
          Unit Cost
          <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => updateField('unit_cost', Number(e.target.value))} />
        </label>
        <label>
          Supplier
          <select value={form.supplier_id} onChange={(e) => updateField('supplier_id', e.target.value)}>
            <option value="">Select supplier (optional)</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.supplier_name}</option>)}
          </select>
        </label>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Item'}</button>
        </div>
      </form>
    </Modal>
  );
}

function StockTransactionModal({ item, onClose, onSaved }) {
  const [transactionType, setTransactionType] = useState('Stock-In');
  const [quantity, setQuantity] = useState(1);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.recordStockTransaction(item._id, { transaction_type: transactionType, quantity, remarks });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error recording transaction.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Record Transaction - ${item.item_name}`} onClose={onClose}>
      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      <p className="muted">Current quantity on hand: <strong>{item.quantity_on_hand}</strong></p>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Transaction Type
          <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
            <option value="Stock-In">Stock-In (Receive Goods)</option>
            <option value="Stock-Out">Stock-Out (Issue/Sell Goods)</option>
          </select>
        </label>
        <label>
          Quantity
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        </label>
        <label>
          Remarks (optional)
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Transaction'}</button>
        </div>
      </form>
    </Modal>
  );
}
