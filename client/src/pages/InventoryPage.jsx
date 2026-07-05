import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import * as api from '../api/services';

const PAGE_SIZE = 10;

export default function InventoryPage() {
  const [itemsPage, setItemsPage] = useState({ items: [], page: 1, totalPages: 1, total: 0 });
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [transactionItem, setTransactionItem] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  async function loadStaticData() {
    try {
      const [catData, supData] = await Promise.all([api.getCategories(), api.getSuppliers()]);
      setCategories(catData);
      setSuppliers(supData);
    } catch (err) {
      setError('Unable to load supporting data.');
    }
  }

  async function loadItems() {
    setLoading(true);
    try {
      const data = await api.getInventoryItems({
        search: search || undefined,
        category_id: categoryFilter || undefined,
        low_stock: lowStockOnly ? 'true' : undefined,
        page,
        limit: PAGE_SIZE,
      });
      setItemsPage(data);
    } catch (err) {
      setError('Unable to load inventory data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaticData();
  }, []);

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, lowStockOnly, page]);

  function resetToFirstPage(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <AppLayout title="Inventory Management">
      <div className="page-toolbar">
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          + Add New Item
        </button>
        <button className="btn-secondary" onClick={() => api.exportStockByCategoryCsv()}>
          ⬇ Export Stock-by-Category CSV
        </button>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search by item name or SKU..."
          value={search}
          onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
          className="filter-input"
        />
        <select
          value={categoryFilter}
          onChange={(e) => resetToFirstPage(setCategoryFilter)(e.target.value)}
          className="filter-select"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.category_name}</option>)}
        </select>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => resetToFirstPage(setLowStockOnly)(e.target.checked)}
          />
          Low stock only
        </label>
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
              {itemsPage.items.map((item) => (
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
              {itemsPage.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    {search || categoryFilter || lowStockOnly
                      ? 'No inventory items match your search/filter.'
                      : 'No inventory items yet. Add your first item above.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {itemsPage.totalPages > 1 && (
            <div className="pagination-bar">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Previous
              </button>
              <span className="pagination-info">
                Page {itemsPage.page} of {itemsPage.totalPages} ({itemsPage.total} items)
              </span>
              <button
                className="btn-secondary"
                disabled={page >= itemsPage.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddItemModal
          categories={categories}
          suppliers={suppliers}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); loadItems(); }}
        />
      )}

      {transactionItem && (
        <StockTransactionModal
          item={transactionItem}
          onClose={() => setTransactionItem(null)}
          onSaved={() => { setTransactionItem(null); loadItems(); }}
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
