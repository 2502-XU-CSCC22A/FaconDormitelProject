// src/pages/tenant/PaymentsPage.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, authHeader } from '../../utils/auth';

const API = 'http://localhost:5000';

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
function isOverdue(share, dueDate) {
  return share.status === 'pending' && (share.overdue === true || new Date(dueDate) < new Date());
}

function StatusBadge({ status, overdue }) {
  if (status === 'paid')
    return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Paid</span>;
  if (overdue)
    return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Overdue</span>;
  return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Pending</span>;
}

function PaymentsPage() {
  const user = useMemo(() => getUser(), []);
  const navigate = useNavigate();
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
      else setError(data.message || 'Failed to load payments.');
    } catch { setError('Failed to connect to the server.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const myShare = useCallback(
    (bill) => bill.shares.find(s => s.tenantId && s.tenantId.toString() === user?._id?.toString()) ?? bill.shares[0],
    [user]
  );

  const totalPaid = useMemo(() => bills.reduce((sum, b) => {
    const s = myShare(b);
    return sum + (s?.status === 'paid' ? s.amount : 0);
  }, 0), [bills, myShare]);

  const paidCount = useMemo(() => bills.filter(b => myShare(b)?.status === 'paid').length, [bills, myShare]);
  const pendingCount = useMemo(() => bills.filter(b => {
    const s = myShare(b);
    return s && s.status === 'pending' && !isOverdue(s, b.dueDate);
  }).length, [bills, myShare]);
  const overdueCount = useMemo(() => bills.filter(b => {
    const s = myShare(b);
    return s && isOverdue(s, b.dueDate);
  }).length, [bills, myShare]);

  const onTimeRate = bills.length > 0 ? Math.round((paidCount / bills.length) * 100) : 0;

  const firstOverdueBill = bills.find(b => { const s = myShare(b); return s && isOverdue(s, b.dueDate); });
  const firstOverdueShare = firstOverdueBill ? myShare(firstOverdueBill) : null;

  return (
    <div className="min-h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Payment tracker</h1>
          <p className="text-sm text-gray-500">Your financial history</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{today}</span>
          <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-xs font-bold shrink-0">{initials}</div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">Loading payment history…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-600 text-sm">{error}</div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total paid</p>
                <p className="text-2xl font-bold mt-1 text-green-600">₱{fmt(totalPaid)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Outstanding</p>
                <p className={`text-2xl font-bold mt-1 ${totalDue > 0 ? 'text-red-600' : 'text-gray-900'}`}>₱{fmt(totalDue)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">On-time rate</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{onTimeRate}%</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Overdue</p>
                <p className={`text-2xl font-bold mt-1 ${overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {overdueCount} {overdueCount === 1 ? 'bill' : 'bills'}
                </p>
              </div>
            </div>

            {/* Payment ledger */}
            {bills.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
                <p className="text-lg font-semibold text-gray-700">No payment history yet</p>
                <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">Your payment records will appear here once bills are created.</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-700">Payment ledger</h2>
                  </div>
                  {/* Table header */}
                  <div className="grid text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100 px-5 py-2.5"
                    style={{ gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1fr' }}>
                    <div>Month</div>
                    <div className="text-right">Amount</div>
                    <div className="text-right">Due date</div>
                    <div className="text-right">Date paid</div>
                    <div className="text-right">Status</div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {bills.map(bill => {
                      const share = myShare(bill);
                      const overdue = share && isOverdue(share, bill.dueDate);
                      return (
                        <div key={bill._id} className="grid items-center px-5 py-3.5 text-sm"
                          style={{ gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1fr' }}>
                          <div className="font-medium text-gray-800">{formatMonth(bill.billingMonth)}</div>
                          <div className="text-right text-gray-600">{share ? `₱${fmt(share.amount)}` : '—'}</div>
                          <div className="text-right text-gray-500 text-xs">{formatDate(bill.dueDate)}</div>
                          <div className="text-right text-gray-500 text-xs">{share?.paidAt ? formatDate(share.paidAt) : '—'}</div>
                          <div className="flex justify-end">
                            {share && <StatusBadge status={share.status} overdue={overdue} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Payment summary + Action needed */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Payment summary</h2>
                    <div className="space-y-2 text-sm">
                      {[
                        { label: 'Paid on time', value: `${paidCount} ${paidCount === 1 ? 'bill' : 'bills'}`, color: 'text-green-600' },
                        { label: 'Pending',      value: `${pendingCount} ${pendingCount === 1 ? 'bill' : 'bills'}`, color: 'text-yellow-600' },
                        { label: 'Overdue',      value: `${overdueCount} ${overdueCount === 1 ? 'bill' : 'bills'}`, color: 'text-red-600' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-gray-500">{label}</span>
                          <span className={`font-semibold ${color}`}>{value}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-gray-100 pt-2">
                        <span className="text-gray-500">Total bills</span>
                        <span className="font-semibold text-gray-800">{bills.length}</span>
                      </div>
                    </div>
                  </div>

                  {firstOverdueBill && firstOverdueShare ? (
                    <div className="bg-white rounded-xl border border-red-200 p-5">
                      <h2 className="text-sm font-semibold text-red-600 mb-2">Action needed</h2>
                      <p className="text-sm text-gray-600">
                        You have an overdue bill from{' '}
                        <span className="font-medium">{formatMonth(firstOverdueBill.billingMonth)}</span>{' '}
                        worth <span className="font-medium text-red-600">₱{fmt(firstOverdueShare.amount)}</span>.
                        Please coordinate with your owner to settle the balance.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/portal/billing')}
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition"
                      >
                        View overdue bill
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-green-200 p-5">
                      <h2 className="text-sm font-semibold text-green-600 mb-2">All clear</h2>
                      <p className="text-sm text-gray-600">You have no overdue bills. Keep it up!</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentsPage;
