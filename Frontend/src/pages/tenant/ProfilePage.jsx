import { useState, useEffect, useCallback, useMemo } from 'react';
import { getUser, authHeader } from '../../utils/auth';

const API = 'http://localhost:5000';

function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.05-3.375M6.228 6.228A9.97 9.97 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.97 9.97 0 01-4.423 5.327M6.228 6.228L3 3m3.228 3.228l3.65 3.65M17.772 17.772L21 21m-3.228-3.228l-3.65-3.65" />
    </svg>
  );
}

function ProfilePage() {
  const storedUser = useMemo(() => getUser(), []);
  const [profile, setProfile] = useState({ name: '', email: storedUser?.email ?? '', phone: '' });
  const [latestBill, setLatestBill] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const today = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const initials = profile.name
    ? profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : (storedUser?.email?.[0] ?? '?').toUpperCase();

  // Edit form state
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [editMsg, setEditMsg]         = useState({ text: '', ok: false });
  const [editLoading, setEditLoading] = useState(false);

  // Password form state
  const [curPw,     setCurPw]     = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg,     setPwMsg]     = useState({ text: '', ok: false });
  const [pwLoading, setPwLoading] = useState(false);

  // Show/hide toggles
  const [showCurPw,     setShowCurPw]     = useState(false);
  const [showNewPw,     setShowNewPw]     = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const [profileRes, billsRes] = await Promise.all([
        fetch(`${API}/api/me`,       { headers: { ...authHeader() } }),
        fetch(`${API}/api/me/bills`, { headers: { ...authHeader() } }),
      ]);
      const [profileData, billsData] = await Promise.all([profileRes.json(), billsRes.json()]);
      if (profileRes.ok) {
        const u = profileData.user;
        setProfile({ name: u.name, email: u.email, phone: u.phone });
        setName(u.name);
        setPhone(u.phone);
      }
      if (billsRes.ok && billsData.bills?.length > 0) setLatestBill(billsData.bills[0]);
    } catch { /* non-critical */ }
    finally { setLoadingProfile(false); }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const roomLabel = latestBill
    ? `${latestBill.roomNameSnapshot} · Active tenant`
    : 'No room assigned';

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditMsg({ text: '', ok: false });
    try {
      const res = await fetch(`${API}/api/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(prev => ({ ...prev, name: data.user.name, phone: data.user.phone }));
        try {
          const stored = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...stored, name: data.user.name }));
        } catch { /* ignore */ }
        setEditMsg({ text: 'Profile updated successfully.', ok: true });
      } else {
        setEditMsg({ text: data.message || 'Update failed.', ok: false });
      }
    } catch {
      setEditMsg({ text: 'Failed to connect to the server.', ok: false });
    } finally {
      setEditLoading(false);
      setTimeout(() => setEditMsg({ text: '', ok: false }), 4000);
    }
  };

  const handlePwSubmit = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwMsg({ text: 'New passwords do not match.', ok: false });
      return;
    }
    setPwLoading(true);
    setPwMsg({ text: '', ok: false });
    try {
      const res = await fetch(`${API}/api/me/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurPw(''); setNewPw(''); setConfirmPw('');
        setShowCurPw(false); setShowNewPw(false); setShowConfirmPw(false);
        setPwMsg({ text: 'Password updated successfully.', ok: true });
      } else {
        setPwMsg({ text: data.message || 'Password change failed.', ok: false });
      }
    } catch {
      setPwMsg({ text: 'Failed to connect to the server.', ok: false });
    } finally {
      setPwLoading(false);
      setTimeout(() => setPwMsg({ text: '', ok: false }), 5000);
    }
  };

  const inputClass = 'w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-orange placeholder:text-gray-600';

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold shrink-0">
                {initials}
              </div>
              <div>
                <p className="text-base font-semibold text-gray-800">{profile.name || 'Tenant'}</p>
                <p className="text-xs text-gray-400">{loadingProfile ? '…' : roomLabel}</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Email',        value: profile.email || '—' },
                { label: 'Phone',        value: profile.phone || '—' },
                { label: 'Move-in date', value: '—' },
                { label: 'Room',         value: latestBill?.roomNameSnapshot ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Edit info — read-only */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Edit info</h2>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={inputClass}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full bg-gray-800 text-gray-500 text-sm rounded-lg px-3 py-2.5 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+63 9XX XXX XXXX"
                  className={inputClass}
                />
              </div>
              {editMsg.text && (
                <p className={`text-xs ${editMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{editMsg.text}</p>
              )}
              <button
                type="submit"
                disabled={editLoading}
                className="w-full py-2 text-sm font-semibold rounded-lg bg-brand-orange hover:bg-brand-orange-dark text-white transition mt-1 disabled:opacity-50"
              >
                {editLoading ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </div>
        </div>

        {/* Change password — read-only */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Change password</h2>
          <form onSubmit={handlePwSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Current password</label>
                <div className="relative">
                  <input
                    type={showCurPw ? 'text' : 'password'}
                    value={curPw}
                    onChange={e => setCurPw(e.target.value)}
                    className={`${inputClass} pr-10`}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowCurPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition">
                    <EyeIcon open={showCurPw} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">New password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    className={`${inputClass} pr-10`}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowNewPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition">
                    <EyeIcon open={showNewPw} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Confirm new password</label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    className={`${inputClass} pr-10`}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowConfirmPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition">
                    <EyeIcon open={showConfirmPw} />
                  </button>
                </div>
              </div>
            </div>
            {pwMsg.text && (
              <p className={`text-xs mt-2 ${pwMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{pwMsg.text}</p>
            )}
            <button
              type="submit"
              disabled={pwLoading}
              className="mt-4 px-5 py-2 text-sm font-semibold rounded-lg bg-gray-900 hover:bg-gray-700 text-white transition disabled:opacity-50"
            >
              {pwLoading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
