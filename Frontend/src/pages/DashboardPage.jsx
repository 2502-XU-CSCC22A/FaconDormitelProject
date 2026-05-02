// src/pages/DashboardPage.jsx
//
// Simple landing page for TENANTS (clients).
// Owners are redirected to /admin/tenants — they should never see this page.
//
// Future: this becomes the real tenant portal (their bills, payment status, etc.).
// For now it's a polished placeholder.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logout } from '../utils/auth';
import logoImage from '../assets/logo.png';
import IconPlaceholder from '../components/IconPlaceholder';

function DashboardPage() {
  const navigate = useNavigate();
  const user = getUser();

  // Defensive: if an owner ends up here somehow, bounce them to the admin panel.
  useEffect(() => {
    if (user?.role === 'owner') {
      navigate('/admin/tenants', { replace: true });
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-peach flex flex-col">
      {/* Header */}
      <header className="bg-white border-b-2 border-brand-orange">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Racon Dormitel" className="h-10 w-auto" />
            <div>
              <h1 className="font-bold text-lg leading-tight">Racon Dormitel</h1>
              <p className="text-xs text-gray-500">Tenant Portal</p>
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

      {/* Main */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-2xl font-bold mb-2">
            Welcome{user?.name ? `, ${user.name}` : ''}!
          </h2>
          <p className="text-gray-600 mb-6">
            You're signed in as <strong>{user?.email}</strong>.
          </p>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
  <div className="flex justify-center mb-4">
    <IconPlaceholder label="" size="xl" />
  </div>
  <p className="text-lg font-semibold text-gray-700 mb-1">
    Your tenant features are coming soon.
  </p>
  ...
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Once your landlord assigns you to a room and creates bills, you'll be able to view
              your room details, monthly bills, and payment status here.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-500 py-6">
        <p>Racon Dormitel © 2026</p>
        <p>Built with React & Tailwind CSS</p>
      </footer>
    </div>
  );
}

export default DashboardPage;