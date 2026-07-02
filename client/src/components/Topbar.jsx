import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ChangePasswordModal from './ChangePasswordModal';

export default function Topbar({ title }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);

  function handleLogout() {
    signOut();
    navigate('/login');
  }

  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-user">
        <div className="topbar-user-info">
          <span className="topbar-user-name">{user?.full_name}</span>
          <span className="topbar-user-role">{user?.role}</span>
        </div>
        <button className="btn-secondary" onClick={() => setShowChangePassword(true)}>
          Change Password
        </button>
        <button className="btn-secondary" onClick={handleLogout}>
          Log Out
        </button>
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </header>
  );
}
