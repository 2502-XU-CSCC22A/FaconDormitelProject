import { useState, useEffect, useCallback, useMemo } from 'react';
import { getUser, authHeader } from '../../utils/auth';

const API = 'http://localhost:5000';

function ProfilePage() {
  const user = useMemo(() => getUser(), []);
  const [latestBill, setLatestBill] = useState(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';

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
                { label: 'Email',        value: user?.email ?? '—' },
                { label: 'Phone',        value: '—' },
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
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Edit info</h2>
            <p className="text-xs text-amber-600 mb-4">Profile editing is coming soon — this section is read-only for now.</p>
            <div className="space-y-3">
              {[
                { label: 'Full name', value: user?.name },
                { label: 'Email',    value: user?.email },
                { label: 'Phone',    value: null },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <div className="w-full bg-gray-100 text-gray-500 text-sm rounded-lg px-3 py-2.5 cursor-not-allowed select-none">
                    {value ?? <span className="italic text-gray-400">not set</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Change password — read-only */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Change password</h2>
          <p className="text-xs text-amber-600 mb-4">Password changes are coming soon — contact your building owner in the meantime.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {['Current password', 'New password', 'Confirm new password'].map(label => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <div className="w-full bg-gray-100 text-gray-400 text-sm rounded-lg px-3 py-2.5 cursor-not-allowed select-none tracking-widest">
                  ••••••••
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
