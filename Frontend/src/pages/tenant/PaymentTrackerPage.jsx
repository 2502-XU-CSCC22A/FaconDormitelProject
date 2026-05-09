// Frontend/src/pages/tenant/PaymentTrackerPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeader } from '../../utils/auth';

const API_BASE = 'http://localhost:5000/api/bills';

const fmt = (n) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n ?? 0);

const fmtPeriod = (period) => {
  if (!period) return '';
  const [y, m] = period.split('-');
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

const StatusBadge = ({ status }) => {
  const map = {
    paid:    'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800'
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
        map[status] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

function PaymentTrackerPage() {
  const navigate = useNavigate();
  const [bills, setBills]         = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter]       = useState('all'); // 'all' | 'paid' | 'pending' | 'overdue'

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res  = await fetch(`${API_BASE}/my`, { headers: authHeader() });
      const data = await res.json();
      if (res.ok) {
        setBills(data.bills || []);
      } else {
        setLoadError(data.message || 'Failed to load payment records.');
      }
    } catch {
      setLoadError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  // ── Derived stats ─────────────────────────────────────────────
  const paidBills    = bills.filter((b) => b.status === 'paid');
  const pendingBills = bills.filter((b) => b.status === 'pending');
  const overdueBills = bills.filter((b) => b.status === 'overdue');

  const totalPaid       = paidBills.reduce((s, b) => s + b.shareAmount, 0);
  const totalOutstanding = [...pendingBills, ...overdueBills].reduce((s, b) => s + b.shareAmount, 0);
  const onTimeRate      = bills.length > 0
    ? Math.round((paidBills.length / bills.length) * 100)
    : 0;

  const filteredBills =
    filter === 'all' ? bills : bills.filter((b) => b.status === filter);

  const tabs = [
    { key: 'all',     label: 'All',     count: bills.length        },
    { key: 'paid',    label: 'Paid',    count: paidBills.length    },
    { key: 'pending', label: 'Pending', count: pendingBills.length },
    { key: 'overdue', label: 'Overdue', count: overdueBills.length }
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Payment Tracker</h2>

      {/* ── Summary cards ──────────────────────────────────────── */}
      {!isLoading && !loadError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total paid</p>
            <p className="text-lg font-bold text-green-700">{fmt(totalPaid)}</p>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Outstanding</p>
            <p className={`text-lg font-bold ${totalOutstanding > 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {fmt(totalOutstanding)}
            </p>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">On-time rate</p>
            <p className={`text-lg font-bold ${onTimeRate >= 80 ? 'text-green-700' : 'text-yellow-700'}`}>
              {onTimeRate}%
            </p>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Overdue</p>
            <p className={`text-lg font-bold ${overdueBills.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {overdueBills.length} {overdueBills.length === 1 ? 'bill' : 'bills'}
            </p>
          </div>
        </div>
      )}

      {/* ── Overdue alert ─────────────────────────────────────── */}
      {overdueBills.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
          <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-semibold text-red-800">Action needed</p>
            <p className="text-sm text-red-700">
              You have {overdueBills.length} overdue{' '}
              {overdueBills.length === 1 ? 'bill' : 'bills'} totalling{' '}
              {fmt(overdueBills.reduce((s, b) => s + b.shareAmount, 0))}. Please
              coordinate with your owner to settle the balance.
            </p>
          </div>
        </div>
      )}

      {/* ── Filter tabs ───────────────────────────────────────── */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={
              'px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ' +
              (filter === key
                ? 'border-brand-orange text-brand-orange'
                : 'border-transparent text-gray-500 hover:text-gray-700')
            }
          >
            {label}
            <span
              className={
                'ml-1 text-xs px-1.5 py-0.5 rounded-full ' +
                (filter === key
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-500')
              }
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Ledger table ─────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-orange-50 px-4 py-3 grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700">
          <div className="col-span-3">Period</div>
          <div className="col-span-2">Room</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-2">Due date</div>
          <div className="col-span-1">Paid on</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Detail</div>
        </div>

        {isLoading ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">
            Loading payment records...
          </div>
        ) : loadError ? (
          <div className="px-4 py-12 text-center text-red-600 text-sm">{loadError}</div>
        ) : filteredBills.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">
            {filter === 'all'
              ? 'No payment records yet.'
              : `No ${filter} bills found.`}
          </div>
        ) : (
          filteredBills.map((bill) => (
            <div
              key={bill._id}
              className="px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm border-t border-gray-100 hover:bg-gray-50"
            >
              <div className="col-span-3 font-medium">{fmtPeriod(bill.period)}</div>
              <div className="col-span-2 text-gray-500">
                Room {bill.room?.roomNumber ?? '—'}
              </div>
              <div className="col-span-2 font-semibold">{fmt(bill.shareAmount)}</div>
              <div className="col-span-2 text-gray-500 text-xs">
                {bill.dueDate
                  ? new Date(bill.dueDate).toLocaleDateString('en-PH')
                  : '—'}
              </div>
              <div className="col-span-1 text-gray-500 text-xs">
                {bill.paidAt
                  ? new Date(bill.paidAt).toLocaleDateString('en-PH')
                  : '—'}
              </div>
              <div className="col-span-1">
                <StatusBadge status={bill.status} />
              </div>
              <div className="col-span-1 text-right">
                <button
                  onClick={() => navigate(`/tenant/bills/${bill._id}`)}
                  className="text-xs text-brand-orange hover:underline"
                >
                  View →
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default PaymentTrackerPage;
