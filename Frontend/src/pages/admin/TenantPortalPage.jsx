// src/pages/admin/TenantPortalPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { authHeader } from '../../utils/auth';

const API = `${import.meta.env.VITE_API_BASE}/api/admin`;

function fmt(n) {
  return Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Simple toast component
function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition ${
            t.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

function TenantPortalPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  const [sendingId, setSendingId] = useState(null);
  const [blasting, setBlasting] = useState(false);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/summary`, { headers: { ...authHeader() } });
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

  const sendReminder = useCallback(async (tenantId) => {
    setSendingId(tenantId);
    try {
      const res = await fetch(`${API}/email/reminder/${tenantId}`, {
        method: 'POST',
        headers: { ...authHeader() }
      });
      const json = await res.json();
      if (res.ok) {
        if (json.emailSent === false) {
          addToast('No outstanding balance — no email sent.', 'success');
        } else {
          addToast('Reminder sent successfully.', 'success');
        }
      } else {
        addToast(json.message || 'Failed to send reminder.', 'error');
      }
    } catch {
      addToast('Failed to connect to the server.', 'error');
    } finally {
      setSendingId(null);
    }
  }, [addToast]);

  const blastAll = useCallback(async () => {
    setBlasting(true);
    try {
      const res = await fetch(`${API}/email/blast`, {
        method: 'POST',
        headers: { ...authHeader() }
      });
      const json = await res.json();
      if (res.ok) {
        if (json.total === 0) {
          addToast('No tenants with overdue or arrears balance.', 'success');
        } else {
          addToast(
            `Blast sent: ${json.sent} delivered, ${json.failed} failed (${json.total} total).`,
            json.failed > 0 ? 'error' : 'success'
          );
        }
      } else {
        addToast(json.message || 'Failed to send email blast.', 'error');
      }
    } catch {
      addToast('Failed to connect to the server.', 'error');
    } finally {
      setBlasting(false);
    }
  }, [addToast]);

  if (isLoading) {
    return <div className="py-20 text-center text-sm text-gray-500">Loading overview...</div>;
  }

  if (error) {
    return <div className="py-20 text-center text-sm text-red-600">{error}</div>;
  }

  return (
    <div>
      <Toast toasts={toasts} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Tenant Billing Overview</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={blastAll}
            disabled={blasting}
            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-md px-3 py-1.5 transition"
          >
            {blasting ? 'Sending…' : 'Blast All'}
          </button>
          <button
            type="button"
            onClick={fetchSummary}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-3 py-1.5 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tenant table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Table header — 12-col grid */}
        <div className="bg-orange-50 px-4 py-3 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
          <div className="col-span-3">Tenant</div>
          <div className="col-span-1">Room</div>
          <div className="col-span-2 text-right">Total Billed</div>
          <div className="col-span-1 text-right">Arrears</div>
          <div className="col-span-2 text-right border-l border-gray-300 pl-2">Overdue</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {data.tenants.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            No tenants yet. Go to Tenant Management to add one.
          </div>
        ) : (
          data.tenants.map((t) => {
            const hasArrears = (t.arrearsAmount ?? 0) > 0;
            const hasOverdue = (t.overdueAmount ?? 0) > 0;
            const hasPending = (t.unpaidAmount ?? 0) > 0;

            // Priority badge: Arrears > Overdue > Pending > Paid
            let badge;
            if (hasArrears) {
              badge = <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">Arrears</span>;
            } else if (hasOverdue) {
              badge = <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">Overdue</span>;
            } else if (hasPending) {
              badge = <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
            } else {
              badge = <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">Paid</span>;
            }

            return (
              <div
                key={t._id}
                className="px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm border-t border-gray-100 hover:bg-gray-50"
              >
                {/* Tenant */}
                <div className="col-span-3 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {t.name || <span className="italic text-gray-400">(no name)</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{t.email}</p>
                </div>

                {/* Room */}
                <div className="col-span-1 text-gray-600">
                  {t.room
                    ? <span className="font-medium text-gray-800">{t.room.roomNumber}</span>
                    : <span className="italic text-gray-400 text-xs">—</span>}
                </div>

                {/* Total Billed */}
                <div className="col-span-2 text-right text-gray-700">
                  {t.totalBilled > 0 ? `₱${fmt(t.totalBilled)}` : <span className="text-gray-400">—</span>}
                </div>

                {/* Arrears amount */}
                <div className="col-span-1 text-right">
                  {hasArrears
                    ? <span className="font-semibold text-orange-600">₱{fmt(t.arrearsAmount)}</span>
                    : <span className="text-gray-400">—</span>}
                </div>

                {/* Overdue amount */}
                <div className="col-span-2 text-right border-l border-gray-200 pl-2">
                  {hasOverdue
                    ? <span className="font-semibold text-red-600">₱{fmt(t.overdueAmount)}</span>
                    : <span className="text-gray-400">—</span>}
                </div>

                {/* Status badge */}
                <div className="col-span-1 flex justify-center">
                  {badge}
                </div>

                {/* Actions */}
                <div className="col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => sendReminder(t._id)}
                    disabled={sendingId === t._id}
                    className="text-xs font-medium text-white bg-brand-orange hover:bg-orange-600 disabled:opacity-50 rounded-md px-2.5 py-1 transition"
                  >
                    {sendingId === t._id ? '…' : 'Remind'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default TenantPortalPage;
