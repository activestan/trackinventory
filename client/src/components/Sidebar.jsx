import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', roles: ['Administrator', 'Store Officer', 'Asset Custodian', 'Manager'] },
  { to: '/inventory', label: 'Inventory', roles: ['Administrator', 'Store Officer', 'Manager'] },
  { to: '/assets', label: 'Assets', roles: ['Administrator', 'Asset Custodian', 'Manager'] },
  { to: '/sales-upload', label: 'Sales Upload', roles: ['Administrator', 'Manager', 'Store Officer'] },
  { to: '/alerts', label: 'Alerts', roles: ['Administrator', 'Store Officer', 'Asset Custodian', 'Manager'] },
  { to: '/users', label: 'Users', roles: ['Administrator'] },
];

export default function Sidebar() {
  const { user } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">📦</span>
        <span className="brand-text">InvenTrack</span>
      </div>
      <nav className="sidebar-nav">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
