// src/pages/tenant/HomePage.jsx
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
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatShortDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}
function isOverdue(share, dueDate) {
  return share.status === 'pending' && (share.overdue === true || new Date(dueDate) < new Date());
}

function StatusBadge({ status, overdue }) {
  if (status === 'paid')
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">Paid</span>;
  if (overdue)
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Overdue</span>;
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Pending</span>;
}

function StatCard({ label, value, sub, valueClass }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function HomePage() {
  const user = useMemo(() => getUser(), []);
  const [bills, setBills] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  const fetchBills = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/me/bills`, { headers: { ...authHeader() } });
      const data = await res.json();
      if (res.ok) { setBills(data.bills ?? []); setTotalDue(data.totalDue ?? 0); }
      else setError(data.message || 'Failed to load bills.');
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

  const lastPaidShare = useMemo(() => {
    for (const bill of bills) {
      const s = myShare(bill);
      if (s?.status === 'paid' && s.paidAt) return s;
    }
    return null;
  }, [bills, myShare]);

  const roommateCount = latestBill ? Math.max(0, latestBill.shares.length - 1) : 0;

  const overdueCount = useMemo(
    () => bills.filter(b => { const s = myShare(b); return s && isOverdue(s, b.dueDate); }).length,
    [bills, myShare]
  );

  // Find which months are overdue for the label
  const overdueMonths = useMemo(
    () => bills.filter(b => { const s = myShare(b); return s && isOverdue(s, b.dueDate); })
      .map(b => formatMonth(b.billingMonth).split(' ')[0]),
    [bills, myShare]
  );

  const recentBills = bills.slice(0, 3);

  return (
    <div className="min-h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back, {user?.name ?? 'Tenant'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{today}</span>
          <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-xs font-bold shrink-0">{initials}</div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">Loading your dashboard…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-600 text-sm">{error}</div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Balance due" value={`₱${fmt(totalDue)}`} valueClass={totalDue > 0 ? 'text-red-600' : 'text-gray-900'} />
              <StatCard
                label="Last payment"
                value={lastPaidShare ? formatShortDate(lastPaidShare.paidAt) : '—'}
                sub={lastPaidShare ? `₱${fmt(lastPaidShare.amount)}` : 'No payments yet'}
              />
              <StatCard label="Roommates" value={roommateCount} sub={`${roommateCount} other occupant${roommateCount !== 1 ? 's' : ''}`} />
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Room status</p>
                <div className="mt-2">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-semibold ${latestBill ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {latestBill ? 'Active' : 'No room'}
                  </span>
                </div>
              </div>
            </div>

            {/* Latest bill + Payment status */}
            {latestBill && latestShare && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Latest bill */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">
                    Latest bill — {formatMonth(latestBill.billingMonth)}
                  </h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Electricity</span>
                      <span className="font-medium">₱{fmt(latestBill.electricity.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Flat fee (Water + WiFi + Rent)</span>
                      <span className="font-medium">₱{fmt(latestBill.flatFee)}</span>
                    </div>
                    <div className="border-t border-gray-100 pt-3 mt-2 flex justify-between items-center">
                      <span className="font-semibold text-gray-800">Your share</span>
                      <span className="text-xl font-bold text-brand-orange">₱{fmt(latestShare.amount)}</span>
                    </div>
                    <div className="flex justify-end pt-1">
                      <StatusBadge status={latestShare.status} overdue={isOverdue(latestShare, latestBill.dueDate)} />
                    </div>
                  </div>
                </div>

                {/* Payment status */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">
                    Payment status — <span className="text-brand-orange">this month</span>
                  </h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Status</span>
                      <StatusBadge status={latestShare.status} overdue={isOverdue(latestShare, latestBill.dueDate)} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Due date</span>
                      <span className="font-medium">{formatDate(latestBill.dueDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Amount</span>
                      <span className="font-semibold">₱{fmt(latestShare.amount)}</span>
                    </div>
                    {overdueCount > 0 && (
                      <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                        <span className="text-gray-500">Overdue bills</span>
                        <span className="text-red-600 font-semibold">
                          {overdueCount} ({overdueMonths.join(', ')})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Recent activity */}
            {recentBills.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-700">Recent activity</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="px-5 py-2 grid grid-cols-12 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                    <div className="col-span-4">Month</div>
                    <div className="col-span-3 text-right">Amount</div>
                    <div className="col-span-3 text-right">Due date</div>
                    <div className="col-span-2 text-right">Status</div>
                  </div>
                  {recentBills.map(bill => {
                    const share = myShare(bill);
                    const overdue = share && isOverdue(share, bill.dueDate);
                    return (
                      <div key={bill._id} className="px-5 py-3 grid grid-cols-12 items-center text-sm">
                        <div className="col-span-4 font-medium text-gray-800">{formatMonth(bill.billingMonth)}</div>
                        <div className="col-span-3 text-right text-gray-600">{share ? `₱${fmt(share.amount)}` : '—'}</div>
                        <div className="col-span-3 text-right text-gray-400 text-xs">{formatDate(bill.dueDate)}</div>
                        <div className="col-span-2 flex justify-end">
                          {share && <StatusBadge status={share.status} overdue={overdue} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
                <p className="text-lg font-semibold text-gray-700">No bills yet</p>
                <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
                  Once your landlord assigns you to a room and creates a bill, it will appear here.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default HomePage;
