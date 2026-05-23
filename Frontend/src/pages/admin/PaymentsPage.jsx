// src/pages/admin/PaymentsPage.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { authHeader } from '../../utils/auth';
import { getShareDisplayStatus } from '../../utils/billStatus';
import PaymentDetailModal from '../../components/admin/PaymentDetailModal';
import iconPayments from '../../assets/payments.png';

const API = import.meta.env.VITE_API_BASE;

function formatMonth(yyyyMM) {
  const [y, m] = yyyyMM.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-PH', {
    month: 'long',
    year: 'numeric'
  });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function fmt(n) {
  return Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function ShareStatusBadge({ share }) {
  const displayStatus = getShareDisplayStatus(share);
  if (displayStatus === 'paid') {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
        Settled
      </span>
    );
  }
  if (displayStatus === 'arrears') {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
        Arrears
      </span>
    );
  }
  if (displayStatus === 'overdue') {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
        Overdue
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
      Pending
    </span>
  );
}

function KpiCard({ icon, label, value, valueClass = '', sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

const IconTotal = () => (
  <img src={iconPayments} alt="" className="w-5 h-5 opacity-70" />
);

const IconPaid = () => (
  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconUnpaid = () => (
  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconRate = () => (
  <svg className="w-5 h-5 text-brand-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
  </svg>
);

function PaymentsPage() {
  const [bills, setBills] = useState([]);
  const [pendingShareIds, setPendingShareIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedShare, setSelectedShare] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [billsRes, paymentsRes] = await Promise.all([
        fetch(`${API}/api/admin/bills`, { headers: { ...authHeader() } }),
        fetch(`${API}/api/admin/payments`, { headers: { ...authHeader() } })
      ]);
      const [billsData, paymentsData] = await Promise.all([
        billsRes.json(),
        paymentsRes.json()
      ]);
      if (billsRes.ok) {
        setBills(billsData.bills ?? []);
      } else {
        setLoadError(billsData.message || 'Failed to load bills.');
      }
      if (paymentsRes.ok) {
        setPendingShareIds(new Set(
          (paymentsData.payments ?? [])
            .filter(p => p.status === 'submitted')
            .map(p => p.shareId.toString())
        ));
      }
    } catch {
      setLoadError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allShares = useMemo(() => {
    const shares = [];
    bills.forEach((bill) => {
      (bill.shares ?? []).forEach((share) => {
        shares.push({
          ...share,
          billId: bill._id,
          billingMonth: bill.billingMonth,
          roomNameSnapshot: bill.roomNameSnapshot,
          dueDate: bill.dueDate
        });
      });
    });
    return shares;
  }, [bills]);

  const totalCount = allShares.length;
  const paidCount = allShares.filter((s) => getShareDisplayStatus(s) === 'paid').length;
  const unpaidCount = allShares.filter((s) => getShareDisplayStatus(s) !== 'paid').length;
  const totalAmount = allShares.reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const paidAmount = allShares
    .filter((s) => getShareDisplayStatus(s) === 'paid')
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const unpaidAmount = allShares
    .filter((s) => getShareDisplayStatus(s) !== 'paid')
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const collectionRate = totalCount === 0
    ? 0
    : Math.round((paidCount / totalCount) * 100);
  const submittedCount = pendingShareIds.size;

  const uniqueRooms = useMemo(
    () => [...new Set(allShares.map(s => s.roomNameSnapshot).filter(Boolean))].sort(),
    [allShares]
  );

  const filteredShares = useMemo(() => {
    let result = allShares;
    if (activeFilter === 'paid') result = result.filter((s) => getShareDisplayStatus(s) === 'paid');
    if (activeFilter === 'unpaid') result = result.filter((s) => getShareDisplayStatus(s) !== 'paid');
    if (selectedRoom) result = result.filter((s) => s.roomNameSnapshot === selectedRoom);
    return result;
  }, [allShares, activeFilter, selectedRoom]);

  const pillClass = (filter) =>
    activeFilter === filter
      ? 'px-4 py-2 rounded-full text-sm font-medium bg-brand-orange text-white transition'
      : 'px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition';

  return (
    <div>
      {/* Pending review banner */}
      {submittedCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6 flex items-center">
          <svg className="w-6 h-6 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <div className="flex-1 ml-3">
            <p className="text-sm font-semibold text-amber-900">
              {submittedCount} bill share{submittedCount > 1 ? 's' : ''} have payment proofs awaiting review
            </p>
            <p className="text-xs text-amber-700 mt-0.5">Tap a row below to review and approve/reject.</p>
          </div>
          <span className="hidden md:block text-xs text-amber-600">↓ Scroll to review</span>
        </div>
      )}

      {/* Page title */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Payment Tracking</h2>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<IconTotal />}
          label="Total Payments"
          value={totalCount}
          sub={`₱${fmt(totalAmount)}`}
        />
        <KpiCard
          icon={<IconPaid />}
          label="Paid"
          value={paidCount}
          valueClass="text-green-600"
          sub={`₱${fmt(paidAmount)}`}
        />
        <KpiCard
          icon={<IconUnpaid />}
          label="Unpaid"
          value={unpaidCount}
          valueClass="text-red-600"
          sub={`₱${fmt(unpaidAmount)}`}
        />
        <KpiCard
          icon={<IconRate />}
          label="Collection Rate"
          value={`${collectionRate}%`}
          valueClass="text-brand-orange"
          sub={`${paidCount} of ${totalCount} paid`}
        />
      </div>

      {/* Filters: room dropdown + status pills */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white min-w-[180px]"
        >
          <option value="">All rooms</option>
          {uniqueRooms.map((room) => (
            <option key={room} value={room}>Room {room}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <button type="button" className={pillClass('all')} onClick={() => setActiveFilter('all')}>
            All ({totalCount})
          </button>
          <button type="button" className={pillClass('paid')} onClick={() => setActiveFilter('paid')}>
            Paid ({paidCount})
          </button>
          <button type="button" className={pillClass('unpaid')} onClick={() => setActiveFilter('unpaid')}>
            Unpaid ({unpaidCount})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-orange-50 px-4 py-3 grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700">
          <div className="col-span-3">Tenant</div>
          <div className="col-span-3">Bill Description</div>
          <div className="col-span-2 text-center">Amount</div>
          <div className="col-span-2">Due Date</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">
            Loading payments...
          </div>
        ) : loadError ? (
          <div className="px-4 py-12 text-center text-red-600 text-sm">
            {loadError}
          </div>
        ) : filteredShares.length === 0 ? (
          <div className="px-4 py-12">
            <div className="border-2 border-dashed border-gray-300 rounded-lg py-12 text-center">
              <div className="flex justify-center mb-3">
                <img src={iconPayments} alt="" className="w-12 h-12 opacity-40" />
              </div>
              <p className="text-sm text-gray-500">
                {selectedRoom
                  ? 'No bill shares match these filters.'
                  : activeFilter === 'paid'
                    ? 'No paid bills yet.'
                    : activeFilter === 'unpaid'
                      ? 'All bills are paid!'
                      : 'No bill shares yet. Create a bill to start tracking.'}
              </p>
            </div>
          </div>
        ) : (
          filteredShares.map((share) => {
            const hasPending = pendingShareIds.has(share._id.toString());
            return (
              <button
                key={`${share.billId}-${share._id}`}
                type="button"
                onClick={() => setSelectedShare(share)}
                className={`w-full text-left px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm border-t border-gray-100 transition ${
                  hasPending
                    ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="col-span-3 font-medium flex items-center min-w-0">
                  <span className="truncate">{share.tenantName ?? '—'}</span>
                  {hasPending && (
                    <>
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 ml-2 flex-shrink-0"
                        title="Payment proof submitted — review pending"
                      />
                      <span className="text-xs text-red-600 ml-1 flex-shrink-0">Proof submitted</span>
                    </>
                  )}
                </div>
                <div className="col-span-3 text-gray-600 truncate">
                  Room {share.roomNameSnapshot ?? '—'}{' '}
                  {share.billingMonth ? `— ${formatMonth(share.billingMonth)}` : ''}
                </div>
                <div className="col-span-2 text-center font-semibold">
                  ₱{fmt(share.amount ?? 0)}
                </div>
                <div className="col-span-2 text-gray-500">
                  {share.dueDate ? formatDate(share.dueDate) : '—'}
                </div>
                <div className="col-span-1">
                  <ShareStatusBadge share={share} />
                </div>
                <div className="col-span-1 text-right">
                  <span className="text-brand-orange text-sm font-medium">View</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {selectedShare && (
        <PaymentDetailModal
          share={selectedShare}
          onClose={() => setSelectedShare(null)}
          onActionComplete={() => {
            fetchData();
            setSelectedShare(null);
          }}
        />
      )}
    </div>
  );
}

export default PaymentsPage;
