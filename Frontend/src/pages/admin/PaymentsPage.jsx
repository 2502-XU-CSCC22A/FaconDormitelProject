// src/pages/admin/PaymentsPage.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { authHeader } from '../../utils/auth';
import PaymentDetailModal from '../../components/admin/PaymentDetailModal';
import iconPayments from '../../assets/payments.png';

const API = 'http://localhost:5000';

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

function isOverdue(share) {
  return share.status === 'pending' && new Date(share.dueDate) < new Date();
}

function ShareStatusBadge({ share }) {
  if (share.status === 'paid') {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
        Paid
      </span>
    );
  }
  if (isOverdue(share)) {
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

const EMPTY_MESSAGES = {
  all: 'No bill shares yet. Create a bill to start tracking.',
  paid: 'No paid bills yet.',
  unpaid: 'All bills are paid!'
};

function PaymentsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedShare, setSelectedShare] = useState(null);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`${API}/api/admin/bills`, {
        headers: { ...authHeader() }
      });
      const data = await res.json();
      if (res.ok) {
        setBills(data.bills ?? []);
      } else {
        setLoadError(data.message || 'Failed to load bills.');
      }
    } catch {
      setLoadError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

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
  const paidCount = allShares.filter((s) => s.status === 'paid').length;
  const unpaidCount = allShares.filter((s) => s.status === 'pending').length;
  const totalAmount = allShares.reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const paidAmount = allShares
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const unpaidAmount = allShares
    .filter((s) => s.status === 'pending')
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const collectionRate = totalCount === 0
    ? 0
    : Math.round((paidCount / totalCount) * 100);

  const filteredShares = useMemo(() => {
    if (activeFilter === 'paid') return allShares.filter((s) => s.status === 'paid');
    if (activeFilter === 'unpaid') return allShares.filter((s) => s.status === 'pending');
    return allShares;
  }, [allShares, activeFilter]);

  const pillClass = (filter) =>
    activeFilter === filter
      ? 'px-4 py-2 rounded-full text-sm font-medium bg-brand-orange text-white transition'
      : 'px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition';

  return (
    <div>
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

      {/* Filter pills */}
      <div className="flex gap-2 mb-4">
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

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-orange-50 px-4 py-3 grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700">
          <div className="col-span-3">Tenant</div>
          <div className="col-span-3">Bill Description</div>
          <div className="col-span-2 text-right">Amount</div>
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
              <p className="text-sm text-gray-500">{EMPTY_MESSAGES[activeFilter]}</p>
            </div>
          </div>
        ) : (
          filteredShares.map((share) => (
            <button
              key={`${share.billId}-${share._id}`}
              type="button"
              onClick={() => setSelectedShare(share)}
              className="w-full text-left px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm border-t border-gray-100 hover:bg-gray-50 transition"
            >
              <div className="col-span-3 font-medium truncate">
                {share.tenantName ?? '—'}
              </div>
              <div className="col-span-3 text-gray-600 truncate">
                Room {share.roomNameSnapshot ?? '—'}{' '}
                {share.billingMonth ? `— ${formatMonth(share.billingMonth)}` : ''}
              </div>
              <div className="col-span-2 text-right font-semibold">
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
          ))
        )}
      </div>

      {selectedShare && (
        <PaymentDetailModal
          share={selectedShare}
          onClose={() => setSelectedShare(null)}
          onActionComplete={() => {
            fetchBills();
            setSelectedShare(null);
          }}
        />
      )}
    </div>
  );
}

export default PaymentsPage;
