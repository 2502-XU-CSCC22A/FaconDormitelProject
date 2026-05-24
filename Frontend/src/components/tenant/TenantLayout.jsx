// src/components/tenant/TenantLayout.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { logout, getUser, setUser, authHeader } from '../../utils/auth';
const API = import.meta.env.VITE_API_BASE;
import logoImage from '../../assets/logo.png';
import homeIcon from '../../assets/Home.png';
import tenantsIcon from '../../assets/tenants.png';
import billsIcon from '../../assets/Bills.png';
import paymentsIcon from '../../assets/payments.png';

// Inline SVG icons — use currentColor so they inherit active/inactive text color
function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// icon: JSX element (SVG) or string (PNG src)
const NAV = [
  { to: '/portal',          label: 'Home',          icon: homeIcon,        end: true },
  { to: '/portal/my-room',  label: 'My Room',       icon: tenantsIcon },
  { to: '/portal/billing',  label: 'Billing',       icon: billsIcon },
  { to: '/portal/payments', label: 'Payments',      icon: paymentsIcon },
  { to: '/portal/notifs',   label: 'Notifications', icon: <BellIcon /> },
  { to: '/portal/profile',  label: 'Profile',       icon: <UserIcon /> },
];

function NavIcon({ icon }) {
  if (!icon) return <span className="w-4 h-4 shrink-0 inline-block" />;
  if (typeof icon === 'string') {
    return <img src={icon} alt="" className="w-4 h-4 shrink-0" />;
  }
  return <span className="w-4 h-4 shrink-0 flex items-center justify-center">{icon}</span>;
}

function TenantLayout() {
  const navigate = useNavigate();
  const [user, setLocalUser] = useState(() => getUser());

  // Bounce owners back to their panel
  useEffect(() => {
    if (user?.role === 'owner') {
      navigate('/admin/tenants', { replace: true });
    }
  }, [user?.role, navigate]);

  // Refresh user data on layout mount — catches room assignment changes, name updates, etc.
  // Without this, tenant would need to logout/login to see changes made by the owner.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { ...authHeader() }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.user) {
          setUser(data.user);          // update localStorage
          setLocalUser(data.user);     // re-render with fresh data
        }
      } catch {
        // Silent fail — keep stale data, app still works
      }
    })();
    return () => { cancelled = true; };
  }, []);  // empty deps — runs ONCE on mount

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-peach flex">
      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100">
          <img src={logoImage} alt="RFacon Dormitel" className="h-8 w-auto" />
          <p className="text-xs text-gray-500 mt-0.5">Tenant Portal</p>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{user?.name ?? 'Tenant'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email ?? ''}</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ' +
                (isActive
                  ? 'bg-brand-orange/10 text-brand-orange'
                  : 'text-gray-600 hover:text-brand-orange hover:bg-gray-50')
              }
            >
              <NavIcon icon={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 text-sm text-gray-500 hover:text-brand-orange transition"
          >
            <span className="w-4 h-4 shrink-0 flex items-center justify-center">
              <LogOutIcon />
            </span>
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}

export default TenantLayout;
