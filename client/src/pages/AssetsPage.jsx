import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import * as api from '../api/services';

const STATUS_BADGE = {
  Available: 'badge-blue',
  'In Use': 'badge-green',
  'Under Repair': 'badge-orange',
  Retired: 'badge-red',
};

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [transferAssetTarget, setTransferAssetTarget] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const [assetsData, catData] = await Promise.all([
        api.getAssets(),
        api.getCategories(),
      ]);
      setAssets(assetsData);
      setCategories(catData);
      try {
        const usersData = await api.getUsers();
        setUsers(usersData);
      } catch {
        setUsers([]); // non-admins cannot list users; that's fine
      }
    } catch (err) {
      setError('Unable to load asset data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AppLayout title="Asset Register">
      <div className="page-toolbar">
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          + Add New Asset
        </button>
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
              {assets.map((asset) => (
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
                    <button className="btn-link" onClick={() => setTransferAssetTarget(asset)}>
                      Assign / Update
                    </button>
                  </td>
                </tr>
              ))}
              {assets.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">No assets registered yet. Add your first asset above.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddAssetModal
          categories={categories}
          users={users}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); loadData(); }}
        />
      )}

      {transferAssetTarget && (
        <TransferAssetModal
          asset={transferAssetTarget}
          users={users}
          onClose={() => setTransferAssetTarget(null)}
          onSaved={() => { setTransferAssetTarget(null); loadData(); }}
        />
      )}
    </AppLayout>
  );
}

function AddAssetModal({ categories, users, onClose, onCreated }) {
  const [form, setForm] = useState({
    asset_tag_no: '', asset_name: '', category_id: '', serial_number: '',
    purchase_date: '', purchase_value: 0, location: '', warranty_expiry: '',
    current_custodian_id: '',
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
