// src/pages/tenant/ProfilePage.jsx
// Edit info and change-password are UI-only — PATCH /api/me and change-password
// endpoints do not exist yet (Phase 2 backend work).
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getUser, authHeader } from '../../utils/auth';

const API = 'http://localhost:5000';

function ProfilePage() {
  const user = useMemo(() => getUser(), []);
  const [latestBill, setLatestBill] = useState(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  // Form state — pre-filled from localStorage user
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [editMsg, setEditMsg] = useState('');

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const fetchBill = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/me/bills`, { headers: { ...authHeader() } });
      const data = await res.json();
      if (res.ok && data.bills?.length > 0) setLatestBill(data.bills[0]);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBill(); }, [fetchBill]);

  const handleEditSubmit = (e) => {
    e.preventDefault();
    setEditMsg('Profile editing is not available yet — backend endpoint coming soon.');
    setTimeout(() => setEditMsg(''), 4000);
  };

  const handlePwSubmit = (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwMsg('New passwords do not match.'); return; }
    setPwMsg('Password change is not available yet — backend endpoint coming soon.');
    setTimeout(() => setPwMsg(''), 4000);
  };

  const roomLabel = latestBill
    ? `${latestBill.roomNameSnapshot} · Active tenant`
    : 'No room assigned';

  return (
    <div className="min-h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Profile &amp; settings</h1>
          <p className="text-sm text-gray-500">Manage your account</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{today}</span>
          <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-xs font-bold shrink-0">{initials}</div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 space-y-5">
        {/* Profile info + Edit form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold shrink-0">
                {initials}
              </div>
              <div>
                <p className="text-base font-semibold text-gray-800">{user?.name ?? 'Tenant'}</p>
                <p className="text-xs text-gray-400">{loading ? '…' : roomLabel}</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Email',         value: user?.email ?? '—' },
                { label: 'Phone',         value: phone || '—' },
                { label: 'Move-in date',  value: '—' },
                { label: 'Room',          value: latestBill?.roomNameSnapshot ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Edit form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Edit info</h2>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+63 9XX XXX XXXX"
                  className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-orange placeholder:text-gray-600"
                />
              </div>
              {editMsg && <p className="text-xs text-amber-600">{editMsg}</p>}
              <button
                type="submit"
                className="w-full py-2 text-sm font-semibold rounded-lg bg-brand-orange hover:bg-brand-orange-dark text-white transition mt-1"
              >
                Save changes
              </button>
            </form>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Change password</h2>
          <form onSubmit={handlePwSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Current password</label>
                <input
                  type="password"
                  value={curPw}
                  onChange={e => setCurPw(e.target.value)}
                  className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">New password</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  placeholder="••••••••"
                />
              </div>
            </div>
            {pwMsg && <p className="text-xs text-amber-600 mt-2">{pwMsg}</p>}
            <button
              type="submit"
              className="mt-4 px-5 py-2 text-sm font-semibold rounded-lg bg-gray-900 hover:bg-gray-700 text-white transition"
            >
              Update password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
