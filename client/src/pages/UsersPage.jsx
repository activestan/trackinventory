import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import * as api from '../api/services';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddUserModal onClose={() => setShowAddModal(false)} onCreated={() => { setShowAddModal(false); loadUsers(); }} />
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
