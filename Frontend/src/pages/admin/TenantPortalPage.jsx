// src/pages/admin/TenantPortalPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { authHeader } from '../../utils/auth';

const API = 'http://localhost:5000/api/admin/summary';

function fmt(n) {
  return Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function TenantPortalPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(API, { headers: { ...authHeader() } });
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setError(json.message || 'Failed to load summary.');
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (isLoading) {
    return <div className="py-20 text-center text-sm text-gray-500">Loading overview...</div>;
  }

  if (error) {
    return <div className="py-20 text-center text-sm text-red-600">{error}</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Tenant Billing Overview</h2>
        <button
          type="button"
          onClick={fetchSummary}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-3 py-1.5 transition"
        >
          Refresh
        </button>
      </div>

      {/* Tenant list — columns: Tenant · Room · Total Billed · Unpaid · Overdue */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-orange-50 px-4 py-3 grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700">
          <div className="col-span-3">Tenant</div>
          <div className="col-span-2">Room</div>
          <div className="col-span-2 text-right">Total Billed</div>
          <div className="col-span-3 text-right">Unpaid</div>
          <div className="col-span-2 text-right">Overdue</div>
        </div>

        {data.tenants.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            No tenants yet. Go to Tenant Management to add one.
          </div>
        ) : (
          data.tenants.map((t) => (
            <div
              key={t._id}
              className="px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm border-t border-gray-100 hover:bg-gray-50"
            >
              <div className="col-span-3 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {t.name || <span className="italic text-gray-400">(no name)</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">{t.email}</p>
              </div>
              <div className="col-span-2 text-gray-600">
                {t.room
                  ? <span className="font-medium text-gray-800">{t.room.roomNumber}</span>
                  : <span className="italic text-gray-400">Unassigned</span>}
              </div>
              <div className="col-span-2 text-right text-gray-700">
                {t.totalBilled > 0 ? `₱${fmt(t.totalBilled)}` : <span className="text-gray-400">—</span>}
              </div>
              <div className="col-span-3 text-right">
                {t.overdueAmount > 0
                  ? <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">Overdue</span>
                  : t.unpaidAmount > 0
                    ? <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Unsettled</span>
                    : <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">Settled</span>}
              </div>
              <div className="col-span-2 text-right">
                {t.overdueAmount > 0
                  ? <span className="font-semibold text-red-600">₱{fmt(t.overdueAmount)}</span>
                  : <span className="text-gray-400">—</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TenantPortalPage;
