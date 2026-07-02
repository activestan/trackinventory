import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Topbar({ title }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
        <button className="btn-secondary" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </header>
  );
}
