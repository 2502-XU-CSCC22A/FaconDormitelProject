// Frontend/src/pages/tenant/BillingStatementsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeader } from '../../utils/auth';

const API_BASE = 'http://localhost:5000/api/bills';

const fmt = (n) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

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

function BillingStatementsPage() {
  const navigate = useNavigate();
  const [bills, setBills]         = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res  = await fetch(`${API_BASE}/my`, { headers: authHeader() });
      const data = await res.json();
      if (res.ok) {
        setBills(data.bills || []);
      } else {
        setLoadError(data.message || 'Failed to load billing statements.');
      }
    } catch {
      setLoadError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  // ── Summary stats ───────────────────────────────────────────────
  const totalBilled  = bills.reduce((s, b) => s + (b.shareAmount ?? 0), 0);
  const totalPaid    = bills.filter((b) => b.status === 'paid').reduce((s, b) => s + b.shareAmount, 0);
  const outstanding  = bills.filter((b) => b.status !== 'paid').reduce((s, b) => s + b.shareAmount, 0);
  const overdueCount = bills.filter((b) => b.status === 'overdue').length;

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Billing Statements</h2>

      {/* ── Summary cards ────────────────────────────────────────── */}
      {!isLoading && !loadError && bills.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total billed',  value: fmt(totalBilled),  color: 'text-gray-800' },
            { label: 'Total paid',    value: fmt(totalPaid),    color: 'text-green-700' },
            { label: 'Outstanding',   value: fmt(outstanding),  color: outstanding > 0 ? 'text-red-600' : 'text-gray-800' },
            { label: 'Overdue bills', value: overdueCount,      color: overdueCount > 0 ? 'text-red-600' : 'text-gray-800' }
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-orange-50 border border-orange-100 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Bills table ───────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-orange-50 px-4 py-3 grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700">
          <div className="col-span-3">Period</div>
          <div className="col-span-2">Room</div>
          <div className="col-span-2">Your share</div>
          <div className="col-span-2">Due date</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Detail</div>
        </div>

        {isLoading ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">
            Loading statements...
          </div>
        ) : loadError ? (
          <div className="px-4 py-12 text-center text-red-600 text-sm">{loadError}</div>
        ) : bills.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">
            No billing statements found yet. Your owner will post your first bill here.
          </div>
        ) : (
          bills.map((bill) => (
            <div
              key={bill._id}
              className="px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm border-t border-gray-100 hover:bg-gray-50"
            >
              <div className="col-span-3 font-medium">{fmtPeriod(bill.period)}</div>
              <div className="col-span-2 text-gray-600">
                Room {bill.room?.roomNumber ?? '—'}
              </div>
              <div className="col-span-2 font-semibold">{fmt(bill.shareAmount)}</div>
              <div className="col-span-2 text-gray-500">
                {bill.dueDate
                  ? new Date(bill.dueDate).toLocaleDateString('en-PH')
                  : '—'}
              </div>
              <div className="col-span-2">
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

export default BillingStatementsPage;
