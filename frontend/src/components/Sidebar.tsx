import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV = [
  {
    path: '/',
    label: 'Boards',
    icon: (
      <svg width="17" height="17" viewBox="0 0 38 38" fill="none">
        <rect x="3" y="6" width="11" height="26" rx="2.5" fill="currentColor"/>
        <rect x="18" y="6" width="17" height="17" rx="2.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    path: '/master',
    label: 'Master Kanban',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="9" y1="6" x2="20" y2="6"/>
        <line x1="9" y1="12" x2="20" y2="12"/>
        <line x1="9" y1="18" x2="20" y2="18"/>
        <line x1="4" y1="6" x2="4.01" y2="6" strokeWidth="2.8"/>
        <line x1="4" y1="12" x2="4.01" y2="12" strokeWidth="2.8"/>
        <line x1="4" y1="18" x2="4.01" y2="18" strokeWidth="2.8"/>
      </svg>
    ),
  },
  {
    path: '/daily',
    label: 'Daily Habits',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="8" y1="14" x2="8" y2="14" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="12" y1="14" x2="12" y2="14" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const goTo = (path: string) => { navigate(path); onClose(); };

  return (
    <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
      <div className="sidebar-logo">
        <svg width="30" height="30" viewBox="0 0 38 38" fill="none">
          <rect width="38" height="38" rx="9" fill="white" fillOpacity="0.15"/>
          <rect x="6" y="8" width="10" height="22" rx="2" fill="white"/>
          <rect x="22" y="8" width="10" height="14" rx="2" fill="white"/>
        </svg>
        <span className="sidebar-logo-text">Kanban</span>
      </div>

      <div className="sidebar-section-label">Menu</div>

      <nav className="sidebar-nav">
        {NAV.map(item => (
          <button
            key={item.path}
            className={`sidebar-nav-item${pathname === item.path ? ' active' : ''}`}
            onClick={() => goTo(item.path)}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-user">
        <div className="sidebar-avatar">{user?.name[0].toUpperCase()}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-email">{user?.email}</div>
        </div>
        <button className="sidebar-logout-btn" title="Logout" onClick={logout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
