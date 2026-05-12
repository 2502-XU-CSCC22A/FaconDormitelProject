// src/pages/admin/PaymentsPage.jsx
import { useState, useEffect, useCallback } from 'react';
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

const STATUS_CLASSES = {
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  voided: 'bg-gray-100 text-gray-700'
};

const STATUS_LABELS = {
  submitted: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  voided: 'Voided'
};

function PaymentStatusBadge({ status }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_CLASSES[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const url =
        statusFilter === 'all'
          ? `${API}/api/admin/payments`
          : `${API}/api/admin/payments?status=${statusFilter}`;
      const res = await fetch(url, { headers: { ...authHeader() } });
      const data = await res.json();
      if (res.ok) {
        setPayments(data.payments ?? []);
      } else {
        setLoadError(data.message || 'Failed to load payments.');
      }
    } catch {
      setLoadError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const pendingCount = payments.filter((p) => p.status === 'submitted').length;
  const selectedPayment = payments.find((p) => p._id === selectedPaymentId) ?? null;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Payment Management</h2>
          {pendingCount > 0 && (
            <span className="bg-orange-100 text-brand-orange text-xs font-semibold px-2.5 py-1 rounded-full">
              {pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md text-sm px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-orange"
        >
          <option value="all">All</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="voided">Voided</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="bg-orange-50 px-4 py-3 grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700">
          <div className="col-span-3">Tenant</div>
          <div className="col-span-3">Bill</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-2">Submitted</div>
          <div className="col-span-2 flex justify-end">Status</div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">
            Loading payments...
          </div>
        ) : loadError ? (
          <div className="px-4 py-12 text-center text-red-600 text-sm">
            {loadError}
          </div>
        ) : payments.length === 0 ? (
          <div className="px-4 py-12">
            <div className="border-2 border-dashed border-gray-300 rounded-lg py-12 text-center">
              <div className="flex justify-center mb-3">
                <img src={iconPayments} alt="" className="w-16 h-16 opacity-50" />
              </div>
              <p className="text-sm text-gray-500">
                No payments yet. Submitted payment proofs will appear here.
              </p>
            </div>
          </div>
        ) : (
          payments.map((payment) => (
            <button
              key={payment._id}
              type="button"
              onClick={() => setSelectedPaymentId(payment._id)}
              className="w-full text-left px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm border-t border-gray-100 hover:bg-gray-50 transition"
            >
              <div className="col-span-3 font-medium truncate">
                {payment.tenantId?.name ?? '—'}
              </div>
              <div className="col-span-3 text-gray-600 truncate">
                {payment.billId?.roomNameSnapshot ?? '—'}
                {payment.billId?.billingMonth
                  ? ` — ${formatMonth(payment.billId.billingMonth)}`
                  : ''}
              </div>
              <div className="col-span-2 text-right font-semibold">
                ₱{fmt(payment.amount)}
              </div>
              <div className="col-span-2 text-gray-500">
                {formatDate(payment.submittedAt)}
              </div>
              <div className="col-span-2 flex justify-end">
                <PaymentStatusBadge status={payment.status} />
              </div>
            </button>
          ))
        )}
      </div>

      {selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          onClose={() => setSelectedPaymentId(null)}
          onActionComplete={fetchPayments}
        />
      )}
    </div>
  );
}

export default PaymentsPage;
