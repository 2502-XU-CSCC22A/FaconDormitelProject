// src/pages/tenant/BillingPage.jsx
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
function formatShortDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function StatusBadge({ status }) {
  if (status === 'paid' || status === 'settled')
    return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Paid</span>;
  if (status === 'arrears' || status === 'unpaid')
    return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">Arrears</span>;
  if (status === 'overdue')
    return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Overdue</span>;
  return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Pending</span>;
}

function BillingPage() {
  const user = useMemo(() => getUser(), []);
  const [bills, setBills] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [arrearsAmount, setArrearsAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  const fetchBills = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/me/bills`, { headers: { ...authHeader() } });
      const data = await res.json();
      if (res.ok) {
        setBills(data.bills ?? []);
        setTotalDue(data.totalDue ?? 0);
        setArrearsAmount(data.arrearsAmount ?? data.arrears ?? 0);
      } else setError(data.message || 'Failed to load billing statements.');
    } catch { setError('Failed to connect to the server.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const myShare = useCallback(
    (bill) => bill.shares.find(s => s.tenantId && s.tenantId.toString() === user?._id?.toString()) ?? bill.shares[0],
    [user]
  );

  const latestBill = bills[0] ?? null;

  const totalBilled = useMemo(() => bills.reduce((sum, b) => sum + (myShare(b)?.amount ?? 0), 0), [bills, myShare]);
  const totalPaid = useMemo(() => bills.reduce((sum, b) => {
    const s = myShare(b);
    return sum + ((s?.status === 'paid' || s?.status === 'settled') ? s.amount : 0);
  }, 0), [bills, myShare]);
  const paidCount = useMemo(
    () => bills.filter(b => { const s = myShare(b); return s?.status === 'paid' || s?.status === 'settled'; }).length,
    [bills, myShare]
  );

  return (
    <div className="min-h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Billing statements</h1>
          <p className="text-sm text-gray-500">{latestBill ? latestBill.roomNameSnapshot : 'Your billing history'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{today}</span>
          <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-xs font-bold shrink-0">{initials}</div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">Loading billing statements…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-600 text-sm">{error}</div>
        ) : (
          <>
            {/* Arrears warning banner */}
            {arrearsAmount > 0 && (
              <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-5 py-4">
                <svg className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-orange-800">
                    You have outstanding arrears of ₱{fmt(arrearsAmount)} from previous billing periods
                  </p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    Please settle your arrears immediately to avoid further action.
                  </p>
                </div>
              </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total billed</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">₱{fmt(totalBilled)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total paid</p>
                <p className="text-2xl font-bold mt-1 text-green-600">₱{fmt(totalPaid)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Outstanding</p>
                <p className={`text-2xl font-bold mt-1 ${totalDue > 0 ? 'text-red-600' : 'text-gray-900'}`}>₱{fmt(totalDue)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Bills on time</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{paidCount} / {bills.length}</p>
              </div>
            </div>

            {/* Billing table */}
            {bills.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
                <p className="text-lg font-semibold text-gray-700">No bills yet</p>
                <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">Your billing history will appear here once your landlord creates a bill.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-700">All billing statements</h2>
                </div>
                {/* Table header */}
                <div className="grid text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100 px-5 py-2.5"
                  style={{ gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr 1fr' }}>
                  <div>Period</div>
                  <div className="text-right">Electricity</div>
                  <div className="text-right">Flat fee</div>
                  <div className="text-right">Your share</div>
                  <div className="text-right">Due date</div>
                  <div className="text-right">Status</div>
                </div>
                {/* Rows */}
                <div className="divide-y divide-gray-100">
                  {bills.map(bill => {
                    const share = myShare(bill);
                    return (
                      <div key={bill._id} className="grid items-center px-5 py-3.5 text-sm hover:bg-gray-50 transition"
                        style={{ gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr 1fr' }}>
                        <div className="font-medium text-gray-800">{formatMonth(bill.billingMonth)}</div>
                        <div className="text-right text-gray-600">₱{fmt(bill.electricity.amount)}</div>
                        <div className="text-right text-gray-600">₱{fmt(bill.flatFee)}</div>
                        <div className="text-right font-semibold text-gray-800">{share ? `₱${fmt(share.amount)}` : '—'}</div>
                        <div className="text-right text-gray-500 text-xs">{formatShortDate(bill.dueDate)}</div>
                        <div className="flex justify-end">
                          {share && <StatusBadge status={share.status} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default BillingPage;
