import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import * as api from '../api/services';

const STATUS_BADGE = {
  Available: 'badge-blue',
  'In Use': 'badge-green',
  'Under Repair': 'badge-orange',
  Retired: 'badge-red',
};

const PAGE_SIZE = 10;

export default function AssetsPage() {
  const { user } = useAuth();
  const [assetsPage, setAssetsPage] = useState({ items: [], page: 1, totalPages: 1, total: 0 });
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [transferAssetTarget, setTransferAssetTarget] = useState(null);
  const [editAssetTarget, setEditAssetTarget] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const isAdministrator = user?.role === 'Administrator';

  async function loadStaticData() {
    try {
      const catData = await api.getCategories();
      setCategories(catData);
      try {
        const usersData = await api.getUsers();
        setUsers(usersData);
      } catch {
        setUsers([]); // non-admins cannot list users; that's fine
      }
    } catch (err) {
      setError('Unable to load supporting data.');
    }
  }

  async function loadAssets() {
    setLoading(true);
    try {
      const data = await api.getAssets({
        search: search || undefined,
        category_id: categoryFilter || undefined,
        current_status: statusFilter || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setAssetsPage(data);
    } catch (err) {
      setError('Unable to load asset data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaticData();
  }, []);

  useEffect(() => {
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, statusFilter, page]);

  function resetToFirstPage(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  async function handleDeleteConfirmed(asset) {
    setError('');
    try {
      await api.deleteAsset(asset._id);
      setConfirmingDelete(null);
      loadAssets();
    } catch (err) {
      setError(err.response?.data?.message || 'Error deleting asset.');
      setConfirmingDelete(null);
    }
  }

  return (
    <AppLayout title="Asset Register">
      <div className="page-toolbar">
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          + Add New Asset
        </button>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search by name, tag, or serial number..."
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
        <select
          value={statusFilter}
          onChange={(e) => resetToFirstPage(setStatusFilter)(e.target.value)}
          className="filter-select"
        >
          <option value="">All Statuses</option>
          <option value="Available">Available</option>
          <option value="In Use">In Use</option>
          <option value="Under Repair">Under Repair</option>
          <option value="Retired">Retired</option>
        </select>
      </div>

      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      {loading ? (
        <p>Loading assets...</p>
      ) : (
        <div className="panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Asset Name</th>
                <th>Category</th>
                <th>Custodian</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assetsPage.items.map((asset) => (
                <tr key={asset._id}>
                  <td>{asset.asset_tag_no}</td>
                  <td>{asset.asset_name}</td>
                  <td>{asset.category_id?.category_name || '—'}</td>
                  <td>{asset.current_custodian_id?.full_name || 'Unassigned'}</td>
                  <td>{asset.location || '—'}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[asset.current_status] || 'badge-blue'}`}>
                      {asset.current_status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="btn-link" onClick={() => setTransferAssetTarget(asset)}>
                        Assign / Update
                      </button>
                      <button className="btn-link" onClick={() => setEditAssetTarget(asset)}>
                        Edit
                      </button>
                      {isAdministrator && (
                        <button
                          className="btn-link"
                          style={{ color: '#dc2626' }}
                          onClick={() => setConfirmingDelete(asset)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {assetsPage.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    {search || categoryFilter || statusFilter
                      ? 'No assets match your search/filter.'
                      : 'No assets registered yet. Add your first asset above.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {assetsPage.totalPages > 1 && (
            <div className="pagination-bar">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Previous
              </button>
              <span className="pagination-info">
                Page {assetsPage.page} of {assetsPage.totalPages} ({assetsPage.total} assets)
              </span>
              <button
                className="btn-secondary"
                disabled={page >= assetsPage.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddAssetModal
          categories={categories}
          users={users}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); loadAssets(); }}
        />
      )}

      {transferAssetTarget && (
        <TransferAssetModal
          asset={transferAssetTarget}
          users={users}
          onClose={() => setTransferAssetTarget(null)}
          onSaved={() => { setTransferAssetTarget(null); loadAssets(); }}
        />
      )}

      {editAssetTarget && (
        <EditAssetModal
          asset={editAssetTarget}
          categories={categories}
          onClose={() => setEditAssetTarget(null)}
          onSaved={() => { setEditAssetTarget(null); loadAssets(); }}
        />
      )}

      {confirmingDelete && (
        <Modal title="Confirm Asset Deletion" onClose={() => setConfirmingDelete(null)}>
          <p>
            Are you sure you want to permanently delete <strong>{confirmingDelete.asset_name}</strong>{' '}
            (Tag {confirmingDelete.asset_tag_no})? This cannot be undone. Its past movement/assignment
            history will remain on record for audit purposes.
          </p>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setConfirmingDelete(null)}>Cancel</button>
            <button
              className="btn-primary"
              style={{ background: '#dc2626' }}
              onClick={() => handleDeleteConfirmed(confirmingDelete)}
            >
              Yes, Delete Asset
            </button>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}

function AddAssetModal({ categories, users, onClose, onCreated }) {
  const [form, setForm] = useState({
    asset_tag_no: '', asset_name: '', category_id: '', serial_number: '',
    purchase_date: '', purchase_value: 0, location: '', warranty_expiry: '',
    review_due_date: '', current_custodian_id: '',
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
      await api.createAsset(form);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Error registering asset.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Register New Asset" onClose={onClose}>
      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Asset Tag Number
          <input required value={form.asset_tag_no} onChange={(e) => updateField('asset_tag_no', e.target.value)} />
        </label>
        <label>
          Asset Name
          <input required value={form.asset_name} onChange={(e) => updateField('asset_name', e.target.value)} />
        </label>
        <label>
          Category
          <select required value={form.category_id} onChange={(e) => updateField('category_id', e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.category_name}</option>)}
          </select>
        </label>
        <label>
          Serial Number
          <input value={form.serial_number} onChange={(e) => updateField('serial_number', e.target.value)} />
        </label>
        <label>
          Purchase Date
          <input type="date" value={form.purchase_date} onChange={(e) => updateField('purchase_date', e.target.value)} />
        </label>
        <label>
          Purchase Value
          <input type="number" min="0" value={form.purchase_value} onChange={(e) => updateField('purchase_value', Number(e.target.value))} />
        </label>
        <label>
          Location
          <input value={form.location} onChange={(e) => updateField('location', e.target.value)} />
        </label>
        <label>
          Warranty Expiry
          <input type="date" value={form.warranty_expiry} onChange={(e) => updateField('warranty_expiry', e.target.value)} />
        </label>
        <label>
          Review Due Date
          <input type="date" value={form.review_due_date} onChange={(e) => updateField('review_due_date', e.target.value)} />
          <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 400 }}>
            Optional: a maintenance/inspection date, independent of warranty. An automated alert is
            sent to Asset Custodians once this date (or the warranty expiry, whichever comes
            first) has passed.
          </span>
        </label>
        <label>
          Initial Custodian
          <select value={form.current_custodian_id} onChange={(e) => updateField('current_custodian_id', e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u._id} value={u._id}>{u.full_name}</option>)}
          </select>
        </label>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Asset'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditAssetModal({ asset, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    asset_name: asset.asset_name,
    category_id: asset.category_id?._id || '',
    serial_number: asset.serial_number || '',
    location: asset.location || '',
    warranty_expiry: asset.warranty_expiry ? asset.warranty_expiry.slice(0, 10) : '',
    review_due_date: asset.review_due_date ? asset.review_due_date.slice(0, 10) : '',
    purchase_value: asset.purchase_value || 0,
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
      await api.updateAsset(asset._id, form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating asset.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit Asset - ${asset.asset_name}`} onClose={onClose}>
      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Asset Name
          <input required value={form.asset_name} onChange={(e) => updateField('asset_name', e.target.value)} />
        </label>
        <label>
          Category
          <select required value={form.category_id} onChange={(e) => updateField('category_id', e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.category_name}</option>)}
          </select>
        </label>
        <label>
          Serial Number
          <input value={form.serial_number} onChange={(e) => updateField('serial_number', e.target.value)} />
        </label>
        <label>
          Location
          <input value={form.location} onChange={(e) => updateField('location', e.target.value)} />
        </label>
        <label>
          Warranty Expiry
          <input type="date" value={form.warranty_expiry} onChange={(e) => updateField('warranty_expiry', e.target.value)} />
        </label>
        <label>
          Review Due Date
          <input type="date" value={form.review_due_date} onChange={(e) => updateField('review_due_date', e.target.value)} />
          <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 400 }}>
            Optional: a maintenance/inspection date, independent of warranty.
          </span>
        </label>
        <label>
          Purchase Value
          <input type="number" min="0" value={form.purchase_value} onChange={(e) => updateField('purchase_value', Number(e.target.value))} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

function TransferAssetModal({ asset, users, onClose, onSaved }) {
  const [toUserId, setToUserId] = useState(asset.current_custodian_id?._id || '');
  const [status, setStatus] = useState(asset.current_status);
  const [conditionNote, setConditionNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (toUserId !== (asset.current_custodian_id?._id || '')) {
        await api.transferAsset(asset._id, { to_user_id: toUserId || null, condition_note: conditionNote });
      }
      if (status !== asset.current_status) {
        await api.updateAssetStatus(asset._id, { current_status: status, condition_note: conditionNote });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating asset.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Manage Asset - ${asset.asset_name}`} onClose={onClose}>
      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Assign To
          <select value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u._id} value={u._id}>{u.full_name}</option>)}
          </select>
        </label>
        <label>
          Status / Condition
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="Available">Available</option>
            <option value="In Use">In Use</option>
            <option value="Under Repair">Under Repair</option>
            <option value="Retired">Retired</option>
          </select>
        </label>
        <label>
          Note
          <input value={conditionNote} onChange={(e) => setConditionNote(e.target.value)} placeholder="Optional remarks" />
        </label>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  );
}
