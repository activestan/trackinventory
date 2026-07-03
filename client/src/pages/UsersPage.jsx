import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import * as api from '../api/services';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      setError('Unable to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleDeactivate(user) {
    setError('');
    try {
      await api.deactivateUser(user._id);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Error deactivating user.');
    }
  }

  async function handleReactivate(user) {
    setError('');
    try {
      await api.updateUser(user._id, { is_active: true });
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Error reactivating user.');
    }
  }

  async function handleDeleteConfirmed(user) {
    setError('');
    try {
      await api.deleteUser(user._id);
      setConfirmingDelete(null);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Error deleting user.');
      setConfirmingDelete(null);
    }
  }

  return (
    <AppLayout title="User Management">
      <div className="page-toolbar">
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          + Add New User
        </button>
      </div>

      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      {loading ? (
        <p>Loading users...</p>
      ) : (
        <div className="panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.department || '—'}</td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="btn-link" onClick={() => setEditingUser(u)}>
                        Edit
                      </button>
                      {u.is_active ? (
                        <button className="btn-link" onClick={() => handleDeactivate(u)}>
                          Deactivate
                        </button>
                      ) : (
                        <button className="btn-link" onClick={() => handleReactivate(u)}>
                          Reactivate
                        </button>
                      )}
                      <button
                        className="btn-link"
                        style={{ color: '#dc2626' }}
                        onClick={() => setConfirmingDelete(u)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddUserModal onClose={() => setShowAddModal(false)} onCreated={() => { setShowAddModal(false); loadUsers(); }} />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => { setEditingUser(null); loadUsers(); }}
        />
      )}

      {confirmingDelete && (
        <Modal title="Confirm Permanent Deletion" onClose={() => setConfirmingDelete(null)}>
          <p>
            Are you sure you want to <strong>permanently delete</strong> the account for{' '}
            <strong>{confirmingDelete.full_name}</strong> ({confirmingDelete.email})? This cannot be
            undone. Their past stock transactions and asset assignment history will remain on
            record, but will no longer display their name.
          </p>
          <p className="muted">
            Tip: if you only want to prevent this person from logging in while keeping their name
            attached to historical records, use <strong>Deactivate</strong> instead.
          </p>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setConfirmingDelete(null)}>Cancel</button>
            <button
              className="btn-primary"
              style={{ background: '#dc2626' }}
              onClick={() => handleDeleteConfirmed(confirmingDelete)}
            >
              Yes, Permanently Delete
            </button>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}

function AddUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'Store Officer', department: '' });
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
      await api.createUser(form);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add New User" onClose={onClose}>
      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Full Name
          <input required value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} />
        </label>
        <label>
          Email
          <input required type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
        </label>
        <label>
          Password
          <input required type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} />
        </label>
        <label>
          Role
          <select value={form.role} onChange={(e) => updateField('role', e.target.value)}>
            <option value="Administrator">Administrator</option>
            <option value="Store Officer">Store Officer</option>
            <option value="Asset Custodian">Asset Custodian</option>
            <option value="Manager">Manager</option>
          </select>
        </label>
        <label>
          Department
          <input value={form.department} onChange={(e) => updateField('department', e.target.value)} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save User'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    department: user.department || '',
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
      await api.updateUser(user._id, form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit User - ${user.full_name}`} onClose={onClose}>
      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Full Name
          <input required value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} />
        </label>
        <label>
          Email
          <input required type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
        </label>
        <label>
          Role
          <select value={form.role} onChange={(e) => updateField('role', e.target.value)}>
            <option value="Administrator">Administrator</option>
            <option value="Store Officer">Store Officer</option>
            <option value="Asset Custodian">Asset Custodian</option>
            <option value="Manager">Manager</option>
          </select>
        </label>
        <label>
          Department
          <input value={form.department} onChange={(e) => updateField('department', e.target.value)} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  );
}
