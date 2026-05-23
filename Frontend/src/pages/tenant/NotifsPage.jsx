// src/pages/tenant/NotifsPage.jsx
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
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}
function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return formatDate(date);
}

// Extract MongoDB ObjectId creation timestamp
function oidToDate(id) {
  try { return new Date(parseInt(id.substring(0, 8), 16) * 1000); }
  catch { return new Date(); }
}

function buildEvents(bills, userId) {
  const events = [];
  for (const bill of bills) {
    const share = bill.shares.find(s => s.tenantId && s.tenantId.toString() === userId?.toString()) ?? bill.shares[0];
    if (!share) continue;
    const month = formatMonth(bill.billingMonth);
    const monthShort = month.split(' ')[0];

    // New bill posted — timestamp from ObjectId
    events.push({
      key: `bill-${bill._id}`,
      color: 'bg-blue-400',
      title: `New bill posted — ${month}`,
      desc: `Your share for ${monthShort} utilities is ₱${fmt(share.amount)}. Due ${formatDate(bill.dueDate)}.`,
      timestamp: oidToDate(bill._id),
    });

    // Payment confirmed (paid or settled)
    if ((share.status === 'paid' || share.status === 'settled') && share.paidAt) {
      events.push({
        key: `paid-${bill._id}`,
        color: 'bg-green-500',
        title: `Payment confirmed — ${month}`,
        desc: `Your ₱${fmt(share.amount)} payment for ${monthShort} was marked as received by the owner.`,
        timestamp: new Date(share.paidAt),
      });
    }

    // Overdue notice
    if (share.status === 'overdue') {
      events.push({
        key: `overdue-${bill._id}`,
        color: 'bg-red-500',
        title: `Overdue — ${month}`,
        desc: `Your ${monthShort} bill of ₱${fmt(share.amount)} is past due. Please settle as soon as possible.`,
        timestamp: new Date(bill.dueDate),
      });
    }

    // Arrears notice (bill moved to arrears after grace period)
    if (share.status === 'arrears' || share.status === 'unpaid') {
      const arrearsDate = new Date(new Date(bill.dueDate).getTime() + (bill.gracePeriodDays ?? 5) * 24 * 60 * 60 * 1000);
      events.push({
        key: `arrears-${bill._id}`,
        color: 'bg-orange-500',
        title: `In arrears — ${month}`,
        desc: `Your ${monthShort} bill of ₱${fmt(share.amount)} has been moved to arrears. Please settle immediately.`,
        timestamp: arrearsDate,
      });
    }
  }
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

// Group events by actual calendar date (Today, Yesterday, day-of-week, or full date)
function groupEvents(events) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Build date → items map
  const dateMap = new Map();
  for (const e of events) {
    const d = e.timestamp;
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const key = dayStart.getTime();
    if (!dateMap.has(key)) dateMap.set(key, { date: dayStart, items: [] });
    dateMap.get(key).items.push(e);
  }

  // Sort dates descending and build labeled groups
  const sortedDates = Array.from(dateMap.values()).sort((a, b) => b.date - a.date);

  return sortedDates.map(({ date, items }) => {
    const diffDays = Math.round((todayStart - date) / 86400000);
    let label;
    if (diffDays === 0) {
      label = 'TODAY';
    } else if (diffDays === 1) {
      label = 'YESTERDAY';
    } else if (diffDays < 7) {
      label = date.toLocaleDateString('en-PH', { weekday: 'long' }).toUpperCase();
    } else {
      label = date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return { label, items };
  });
}

function NotifsPage() {
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
      else setError(data.message || 'Failed to load notifications.');
    } catch { setError('Failed to connect to the server.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const events = useMemo(() => buildEvents(bills, user?._id), [bills, user]);
  const groups = useMemo(() => groupEvents(events), [events]);
  const unreadCount = useMemo(
    () => events.filter(e => Date.now() - e.timestamp.getTime() < 7 * 86400000).length,
    [events]
  );

  return (
    <div className="min-h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{today}</span>
          <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-xs font-bold shrink-0">{initials}</div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">Loading notifications…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-600 text-sm">{error}</div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
            <p className="text-lg font-semibold text-gray-700">No notifications yet</p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">Activity from your bills and payments will appear here.</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">{group.label}</p>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {group.items.map(event => (
                  <div key={event.key} className="flex items-start gap-3 px-5 py-4">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${event.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{event.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{event.desc}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 pt-0.5">{timeAgo(event.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NotifsPage;
