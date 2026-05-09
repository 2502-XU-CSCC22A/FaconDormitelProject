// Frontend/src/pages/tenant/BillDetailPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

function BillDetailPage() {
  const { billId } = useParams();
  const navigate   = useNavigate();

  const [bill, setBill]           = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchBill = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res  = await fetch(`${API_BASE}/my/${billId}`, { headers: authHeader() });
      const data = await res.json();
      if (res.ok) {
        setBill(data.bill);
      } else {
        setLoadError(data.message || 'Failed to load bill.');
      }
    } catch {
      setLoadError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  }, [billId]);

  useEffect(() => { fetchBill(); }, [fetchBill]);

  if (isLoading) {
    return (
      <div className="py-16 text-center text-gray-500 text-sm">Loading bill details...</div>
    );
  }

  if (loadError) {
    return (
      <div className="py-16 text-center">
        <p className="text-red-600 text-sm mb-4">{loadError}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-brand-orange hover:underline">
          ← Go back
        </button>
      </div>
    );
  }

  if (!bill) return null;

  const { utilities, totalAmount, tenantCount, myShare, allSplits, room, period, dueDate } = bill;
  const utilityTotal = (utilities?.electricity ?? 0) + (utilities?.water ?? 0) + (utilities?.internet ?? 0);

  return (
    <div className="max-w-2xl">
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-brand-orange hover:underline mb-4 inline-block"
      >
        ← Back to statements
      </button>

      <h2 className="text-xl font-bold mb-1">
        {fmtPeriod(period)} — Bill Detail
      </h2>
      <p className="text-sm text-gray-500 mb-6">Room {room?.roomNumber ?? '—'}</p>

      {/* ── Full room utility breakdown ─────────────────────────── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
        <div className="bg-orange-50 px-4 py-3 text-sm font-semibold text-gray-700">
          Utility Breakdown — Full Room
        </div>
        <div className="px-4">
          {[
            { label: 'Electricity', value: utilities?.electricity },
            { label: 'Water',       value: utilities?.water       },
            { label: 'Internet',    value: utilities?.internet    }
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-3 border-b border-gray-100 text-sm">
              <span className="text-gray-600">{label}</span>
              <span className="font-medium">{fmt(value)}</span>
            </div>
          ))}
          <div className="flex justify-between py-3 text-sm font-semibold text-gray-800">
            <span>Total room bill</span>
            <span>{fmt(totalAmount ?? utilityTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── Your share (highlighted) ────────────────────────────── */}
      <div className="border-2 border-orange-300 bg-orange-50 rounded-lg px-4 py-4 mb-4">
        <p className="text-sm font-semibold text-orange-800 mb-3">Your Share (Auto-Calculated)</p>
        <div className="flex justify-between text-sm py-2 border-b border-orange-200">
          <span className="text-gray-600">Total room bill</span>
          <span>{fmt(totalAmount ?? utilityTotal)}</span>
        </div>
        <div className="flex justify-between text-sm py-2 border-b border-orange-200">
          <span className="text-gray-600">Number of tenants</span>
          <span>÷ {tenantCount}</span>
        </div>
        <div className="flex justify-between items-center mt-3">
          <span className="font-bold text-gray-800">Amount you owe</span>
          <span className="text-2xl font-bold text-brand-orange">
            {fmt(myShare?.shareAmount)}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {fmt(totalAmount ?? utilityTotal)} ÷ {tenantCount} tenants = {fmt(myShare?.shareAmount)} per person
        </p>
      </div>

      {/* ── Bill info ───────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
        <div className="bg-orange-50 px-4 py-3 text-sm font-semibold text-gray-700">
          Bill Info
        </div>
        <div className="px-4">
          {[
            {
              label: 'Billing period',
              value: fmtPeriod(period)
            },
            {
              label: 'Due date',
              value: dueDate ? new Date(dueDate).toLocaleDateString('en-PH', { dateStyle: 'long' }) : '—'
            },
            {
              label: 'Your status',
              value: <StatusBadge status={myShare?.status ?? 'pending'} />
            },
            {
              label: 'Paid on',
              value: myShare?.paidAt
                ? new Date(myShare.paidAt).toLocaleDateString('en-PH', { dateStyle: 'long' })
                : '—'
            }
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-3 border-b border-gray-100 text-sm last:border-0">
              <span className="text-gray-600">{label}</span>
              <span className="font-medium text-gray-800">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Roommates on this bill ──────────────────────────────── */}
      {allSplits && allSplits.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-orange-50 px-4 py-3 text-sm font-semibold text-gray-700">
            Roommates on this Bill
          </div>
          <div className="px-4">
            {allSplits.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 text-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-semibold">
                    {(s.tenant?.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-gray-800">{s.tenant?.name || 'Unknown'}</span>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default BillDetailPage;
