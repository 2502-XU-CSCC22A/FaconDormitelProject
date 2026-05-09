// Frontend/src/pages/admin/BillsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { authHeader } from '../../utils/auth';

const API_BASE  = 'http://localhost:5000/api/admin';

// ── Helpers ──────────────────────────────────────────────────────
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
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────
function BillsPage() {
  // Room list (for the create-bill form)
  const [rooms, setRooms]       = useState([]);
  const [bills, setBills]       = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Expanded bill row
  const [expandedId, setExpandedId] = useState(null);

  // Create-bill form
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({
    roomId: '', period: '', dueDate: '',
    electricity: '', water: '', internet: ''
  });
  const [formError, setFormError]   = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Fetch data ────────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    try {
      const res  = await fetch('http://localhost:5000/api/rooms', { headers: authHeader() });
      const data = await res.json();
      if (res.ok) setRooms(data.rooms || []);
    } catch { /* silent — rooms list is optional for the form */ }
  }, []);

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res  = await fetch(`${API_BASE}/bills`, { headers: authHeader() });
      const data = await res.json();
      if (res.ok) {
        setBills(data.bills || []);
      } else {
        setLoadError(data.message || 'Failed to load bills');
      }
    } catch {
      setLoadError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchBills();
  }, [fetchRooms, fetchBills]);

  // ── Create bill ───────────────────────────────────────────────
  const handleFormChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreateBill = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    const { roomId, period, dueDate, electricity, water, internet } = form;

    if (!roomId || !period || !dueDate) {
      setFormError('Room, period, and due date are required.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          roomId,
          period,
          dueDate,
          utilities: {
            electricity: Number(electricity) || 0,
            water:       Number(water)       || 0,
            internet:    Number(internet)    || 0
          }
        })
      });
      const data = await res.json();

      if (res.ok) {
        setShowForm(false);
        setForm({ roomId: '', period: '', dueDate: '', electricity: '', water: '', internet: '' });
        fetchBills();
      } else {
        setFormError(data.message || 'Failed to create bill.');
      }
    } catch {
      setFormError('Failed to connect to the server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Update payment status ─────────────────────────────────────
  const handleStatusChange = async (billId, tenantId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/bills/${billId}/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchBills();
    } catch {
      alert('Failed to update status. Please try again.');
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Bill Management</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold px-4 py-2 rounded-md transition"
          >
            + New Bill
          </button>
        )}
      </div>

      {/* ── Create bill form ──────────────────────────────────── */}
      {showForm && (
        <div className="border border-gray-300 rounded-lg p-5 mb-6 bg-gray-50">
          <h3 className="font-semibold mb-4">Post Monthly Utilities</h3>
          <form onSubmit={handleCreateBill}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Room */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                <select
                  name="roomId"
                  value={form.roomId}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
                >
                  <option value="">Select a room</option>
                  {rooms.map((r) => (
                    <option key={r._id} value={r._id}>
                      Room {r.roomNumber} ({r.currentOccupants}/{r.capacity} tenants)
                    </option>
                  ))}
                </select>
              </div>

              {/* Period */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billing Period
                </label>
                <input
                  type="month"
                  name="period"
                  value={form.period}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, period: e.target.value }))
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>

              {/* Due date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  name="dueDate"
                  value={form.dueDate}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
            </div>

            {/* Utility amounts */}
            <p className="text-sm font-medium text-gray-700 mb-2">
              Utility Amounts <span className="text-gray-400 font-normal">(leave blank if not applicable)</span>
            </p>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Electricity (₱)', name: 'electricity' },
                { label: 'Water (₱)',       name: 'water'       },
                { label: 'Internet (₱)',    name: 'internet'    }
              ].map(({ label, name }) => (
                <div key={name}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input
                    type="number"
                    name={name}
                    value={form[name]}
                    onChange={handleFormChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
              ))}
            </div>

            {/* Live preview */}
            {(form.electricity || form.water || form.internet) && (
              <div className="bg-orange-50 border border-orange-200 rounded-md px-4 py-3 mb-4 text-sm">
                <span className="font-medium">Total:</span>{' '}
                {fmt(
                  (Number(form.electricity) || 0) +
                  (Number(form.water)       || 0) +
                  (Number(form.internet)    || 0)
                )}
              </div>
            )}

            {formError && (
              <p className="text-red-600 text-sm mb-3">{formError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={
                  'px-4 py-2 text-sm font-semibold rounded-md transition ' +
                  (!isSubmitting
                    ? 'bg-brand-orange hover:bg-brand-orange-dark text-white'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed')
                }
              >
                {isSubmitting ? 'Posting...' : 'Post Bill'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(''); }}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Bills list ─────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="bg-orange-50 px-4 py-3 grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700">
          <div className="col-span-2">Room</div>
          <div className="col-span-3">Period</div>
          <div className="col-span-2">Total</div>
          <div className="col-span-2">Due Date</div>
          <div className="col-span-2">Progress</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {isLoading ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">Loading bills...</div>
        ) : loadError ? (
          <div className="px-4 py-12 text-center text-red-600 text-sm">{loadError}</div>
        ) : bills.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">
            No bills posted yet. Click "+ New Bill" to get started.
          </div>
        ) : (
          bills.map((bill) => {
            const paidCount = bill.tenantSplits.filter((s) => s.status === 'paid').length;
            const total     = bill.tenantSplits.length;
            const isOpen    = expandedId === bill._id;

            return (
              <div key={bill._id}>
                {/* Bill summary row */}
                <div className="px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm border-t border-gray-100 hover:bg-gray-50">
                  <div className="col-span-2 font-medium">
                    Room {bill.room?.roomNumber ?? '—'}
                  </div>
                  <div className="col-span-3">{fmtPeriod(bill.period)}</div>
                  <div className="col-span-2">{fmt(bill.totalAmount)}</div>
                  <div className="col-span-2 text-gray-500">
                    {bill.dueDate
                      ? new Date(bill.dueDate).toLocaleDateString('en-PH')
                      : '—'}
                  </div>
                  <div className="col-span-2 text-xs text-gray-600">
                    {paidCount}/{total} paid
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      onClick={() => setExpandedId(isOpen ? null : bill._id)}
                      className="text-xs text-brand-orange hover:underline"
                    >
                      {isOpen ? 'Close' : 'Details'}
                    </button>
                  </div>
                </div>

                {/* Expanded: per-tenant payment status */}
                {isOpen && (
                  <div className="bg-gray-50 border-t border-gray-100 px-6 py-4">
                    {/* Utility breakdown */}
                    <div className="mb-3 text-xs text-gray-500 flex gap-4">
                      <span>Electricity: {fmt(bill.utilities?.electricity ?? 0)}</span>
                      <span>Water: {fmt(bill.utilities?.water ?? 0)}</span>
                      <span>Internet: {fmt(bill.utilities?.internet ?? 0)}</span>
                      <span className="font-semibold text-gray-700">
                        Each tenant: {fmt(bill.tenantSplits[0]?.shareAmount ?? 0)}
                      </span>
                    </div>

                    {/* Per-tenant rows */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                          <th className="pb-1 font-medium">Tenant</th>
                          <th className="pb-1 font-medium">Amount</th>
                          <th className="pb-1 font-medium">Status</th>
                          <th className="pb-1 font-medium">Paid on</th>
                          <th className="pb-1 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bill.tenantSplits.map((split, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="py-2 text-gray-800">
                              {split.tenant?.name || split.tenant?.email || 'Unknown'}
                            </td>
                            <td className="py-2">{fmt(split.shareAmount)}</td>
                            <td className="py-2">
                              <StatusBadge status={split.status} />
                            </td>
                            <td className="py-2 text-gray-500 text-xs">
                              {split.paidAt
                                ? new Date(split.paidAt).toLocaleDateString('en-PH')
                                : '—'}
                            </td>
                            <td className="py-2">
                              <select
                                value={split.status}
                                onChange={(e) =>
                                  handleStatusChange(
                                    bill._id,
                                    split.tenant?._id,
                                    e.target.value
                                  )
                                }
                                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                              >
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                                <option value="overdue">Overdue</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default BillsPage;
