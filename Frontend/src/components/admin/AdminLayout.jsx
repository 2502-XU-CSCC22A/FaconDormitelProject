// src/components/admin/AdminLayout.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../../utils/auth';
import logoImage from '../../assets/logo.png';
import IconPlaceholder from '../IconPlaceholder';

const TABS = [
  { to: '/admin/rooms',         label: 'Rooms',         icon: 'R' },
  { to: '/admin/tenants',       label: 'Tenants',       icon: 'T' },
  { to: '/admin/bills',         label: 'Bills',         icon: 'B' },
  { to: '/admin/payments',      label: 'Payments',      icon: 'P' },
  { to: '/admin/tenant-portal', label: 'Tenant Portal', icon: 'TP' },
];

function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-peach flex flex-col">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="bg-white border-b-2 border-brand-orange">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Racon Dormitel" className="h-10 w-auto" />
            <div>
              <h1 className="font-bold text-lg leading-tight">Dormitel Admin Panel</h1>
              <p className="text-xs text-gray-500">Room & Billing Management System</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-brand-orange transition"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* ── Main content area ─────────────────────────── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">
        {/* Tab navigation */}
        <nav className="bg-white rounded-t-lg border border-gray-200 px-2 pt-2 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
         <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
          `px-4 py-2 text-sm font-medium rounded-t-md transition flex items-center gap-2 whitespace-nowrap ` +
           (isActive
      ? 'bg-brand-orange/10 text-brand-orange border-b-2 border-brand-orange -mb-px'
      : 'text-gray-600 hover:text-brand-orange hover:bg-gray-50')
  }
>
  <IconPlaceholder label={tab.iconChar} size="sm" />
  {tab.label}
</NavLink>
          ))}
        </nav>

        {/* Page content */}
        <div className="bg-white rounded-b-lg border-x border-b border-gray-200 p-6 min-h-[400px]">
          <Outlet />
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="text-center text-xs text-gray-500 py-6">
        <p>Racon Dormitel Admin Panel © 2026</p>
        <p>Built with React & Tailwind CSS</p>
      </footer>
    </div>
  );
}

export default AdminLayout;