// src/pages/tenant/MyRoomPage.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getUser, authHeader } from '../../utils/auth';

const API = import.meta.env.VITE_API_BASE;

function fmt(n) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatMonth(yyyyMM) {
  const [y, m] = yyyyMM.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-PH', { month: 'long', year: 'numeric' });
}

function MyRoomPage() {
  const user = useMemo(() => getUser(), []);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  const fetchBills = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/me/bills`, { headers: { ...authHeader() } });
      const data = await res.json();
      if (res.ok) setBills(data.bills ?? []);
      else setError(data.message || 'Failed to load room info.');
    } catch { setError('Failed to connect to the server.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const myShare = useCallback(
    (bill) => bill.shares.find(s => s.tenantId && s.tenantId.toString() === user?._id?.toString()) ?? bill.shares[0],
    [user]
  );

  const latestBill = bills[0] ?? null;
  const latestShare = latestBill ? myShare(latestBill) : null;
  const occupants = latestBill?.shares.length ?? 0;

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">My room</h1>
          <p className="text-sm text-gray-500">
            {latestBill ? `${latestBill.roomNameSnapshot} details & roommates` : 'Room details & roommates'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{today}</span>
          <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-xs font-bold shrink-0">{initials}</div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">Loading room info…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-600 text-sm">{error}</div>
        ) : !latestBill ? (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
            <p className="text-lg font-semibold text-gray-700">No room assigned</p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">You haven't been assigned to a room yet.</p>
          </div>
        ) : (
          <>
            {/* Room details + Bill split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Room details */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Room details</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Room number</span>
                    <span className="font-medium">{latestBill.roomNameSnapshot}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Current occupants</span>
                    <span className="font-medium">{occupants} tenant{occupants !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="pt-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{occupants} occupied</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-brand-orange h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (occupants / Math.max(occupants, 4)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bill split info */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Bill split info</h2>
                <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 mb-4 text-xs text-gray-500">
                  How your bill is calculated<br />
                  <span className="font-medium text-gray-700">Total room utilities ÷ no. of tenants = your share</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total room bill ({formatMonth(latestBill.billingMonth).split(' ')[0]})</span>
                    <span className="font-medium">₱{fmt(latestBill.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tenants in room</span>
                    <span className="font-medium">{occupants}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-3">
                    <span className="font-semibold text-gray-800">Your share</span>
                    <span className="text-lg font-bold text-brand-orange">₱{fmt(latestShare?.amount ?? 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Roommates */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Roommates</h2>
              <div className="space-y-3">
                {latestBill.shares.map((share, i) => {
                  const isMe = share.tenantId && share.tenantId.toString() === user?._id?.toString();
                  const name = share.tenantName ?? 'Unknown';
                  const abbr = getInitials(name);
                  const colors = ['bg-brand-orange', 'bg-blue-400', 'bg-green-500', 'bg-purple-400'];
                  const color = colors[i % colors.length];
                  return (
                    <div key={share.tenantId ?? i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                          {abbr}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{name}</p>
                          <p className="text-xs text-gray-400">{share.tenantEmail ?? ''}</p>
                        </div>
                      </div>
                      {isMe && (
                        <span className="text-xs font-semibold text-brand-orange border border-brand-orange/30 bg-brand-orange/5 px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MyRoomPage;
