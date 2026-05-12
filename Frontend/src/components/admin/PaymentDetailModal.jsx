// src/components/admin/PaymentDetailModal.jsx
import { useState, useEffect } from 'react';
import { authHeader } from '../../utils/auth';

const API = 'http://localhost:5000';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.4)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '40px 20px',
  overflowY: 'auto'
};

const modalStyle = {
  background: '#fff',
  borderRadius: '12px',
  padding: '28px',
  maxWidth: '640px',
  width: '100%',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
};

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

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
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

function PaymentStatusBadge({ status, large = false }) {
  const sizeClass = large
    ? 'px-3 py-1 text-sm font-semibold rounded-full'
    : 'px-2 py-0.5 text-xs font-semibold rounded-full';
  return (
    <span className={`inline-block ${sizeClass} ${STATUS_CLASSES[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ProofImage({ proofImagePath }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!proofImagePath) return;
    let revoked = false;
    let objectUrl = null;

    (async () => {
      try {
        const res = await fetch(
          `${API}/uploads/${proofImagePath}`,
          { headers: { ...authHeader() } }
        );
        if (!res.ok) throw new Error('Failed to load proof');
        const blob = await res.blob();
        if (!revoked) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        }
      } catch {
        if (!revoked) setError(true);
      }
    })();

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [proofImagePath]);

  if (error) return <div className="text-sm text-red-600">Failed to load proof image</div>;
  if (!src) return <div className="text-sm text-gray-400">Loading proof...</div>;
  return (
    <img
      src={src}
      alt="Payment proof"
      className="max-w-full max-h-96 mx-auto rounded border border-gray-200"
    />
  );
}

function PaymentDetailModal({ payment, onClose, onActionComplete }) {
  const [actionMode, setActionMode] = useState('idle');
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const resetAction = () => {
    setActionMode('idle');
    setActionReason('');
    setActionError('');
  };

  const handleApprove = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      const res = await fetch(`${API}/api/admin/payments/${payment._id}/approve`, {
        method: 'POST',
        headers: { ...authHeader() }
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message || 'Failed to approve payment.');
        return;
      }
      onActionComplete();
      onClose();
    } catch {
      setActionError('Failed to connect to the server.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!actionReason.trim()) {
      setActionError('A reason is required to reject this payment.');
      return;
    }
    setActionLoading(true);
    setActionError('');
    try {
      const res = await fetch(`${API}/api/admin/payments/${payment._id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ reason: actionReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message || 'Failed to reject payment.');
        return;
      }
      onActionComplete();
      onClose();
    } catch {
      setActionError('Failed to connect to the server.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!actionReason.trim()) {
      setActionError('A reason is required to void this payment.');
      return;
    }
    setActionLoading(true);
    setActionError('');
    try {
      const res = await fetch(`${API}/api/admin/payments/${payment._id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ reason: actionReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message || 'Failed to void payment.');
        return;
      }
      onActionComplete();
      onClose();
    } catch {
      setActionError('Failed to connect to the server.');
    } finally {
      setActionLoading(false);
    }
  };

  const { status } = payment;
  const tenantName = payment.tenantId?.name ?? '—';
  const tenantEmail = payment.tenantId?.email ?? '—';
  const roomSnap = payment.billId?.roomNameSnapshot ?? '—';
  const billingMonth = payment.billId?.billingMonth
    ? formatMonth(payment.billId.billingMonth)
    : '—';
  const billShortId = payment.billId?._id?.slice(0, 8) ?? '—';

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>

        {/* Title bar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold">Payment Details</h3>
            <PaymentStatusBadge status={status} large />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none"
          >
            ×
          </button>
        </div>

        {/* Tenant */}
        <div className="border border-gray-100 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Tenant</p>
          <p className="font-semibold text-base">{tenantName}</p>
          <p className="text-sm text-gray-500">{tenantEmail}</p>
        </div>

        {/* Bill */}
        <div className="border border-gray-100 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Bill</p>
          <p className="font-medium text-sm">{roomSnap} — {billingMonth}</p>
          <p className="text-xs text-gray-400 mt-0.5">Bill ID: {billShortId}…</p>
        </div>

        {/* Payment details */}
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Payment Details</p>
          <p className="text-2xl font-bold text-brand-orange mb-3">₱{fmt(payment.amount)}</p>
          <div className="space-y-1 text-sm text-gray-600">
            {payment.paymentDate && (
              <div className="flex justify-between">
                <span>Payment date</span>
                <span className="text-gray-800">{formatDate(payment.paymentDate)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Submitted</span>
              <span className="text-gray-800">{formatDateTime(payment.submittedAt)}</span>
            </div>
            {payment.reviewedAt && (
              <div className="flex justify-between">
                <span>Reviewed</span>
                <span className="text-gray-800">{formatDateTime(payment.reviewedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Proof image */}
        {payment.proofImagePath && (
          <div className="border border-gray-100 rounded-lg p-4 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Payment Proof</p>
            <div className="flex justify-center">
              <ProofImage proofImagePath={payment.proofImagePath} />
            </div>
          </div>
        )}

        {/* Rejection reason */}
        {status === 'rejected' && payment.rejectReason && (
          <div className="border border-red-200 bg-red-50 rounded-lg p-4 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-400 mb-1">Rejection Reason</p>
            <p className="text-sm text-red-700">{payment.rejectReason}</p>
          </div>
        )}

        {/* Void reason */}
        {status === 'voided' && payment.voidReason && (
          <div className="border border-gray-200 bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Voided</p>
            <p className="text-sm text-gray-600">{payment.voidReason}</p>
          </div>
        )}

        {/* Inline action error */}
        {actionError && (
          <div className="border border-red-200 bg-red-50 rounded-md px-3 py-2 text-sm text-red-700 mb-4">
            {actionError}
          </div>
        )}

        {/* Actions — submitted */}
        {status === 'submitted' && (
          <div className="space-y-3">
            {actionMode === 'idle' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setActionError(''); setActionMode('approve-confirm'); }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-md transition"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => { setActionError(''); setActionMode('reject-form'); }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-md transition"
                >
                  Reject
                </button>
              </div>
            )}

            {actionMode === 'approve-confirm' && (
              <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800 mb-3">Approve this payment?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-md transition"
                  >
                    {actionLoading ? 'Approving…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={resetAction}
                    disabled={actionLoading}
                    className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-semibold px-4 py-2 rounded-md transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {actionMode === 'reject-form' && (
              <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800 mb-2">Rejection reason (required)</p>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={3}
                  className="w-full border border-red-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 bg-white mb-3"
                  placeholder="Enter reason for rejection…"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-md transition"
                  >
                    {actionLoading ? 'Rejecting…' : 'Confirm Reject'}
                  </button>
                  <button
                    type="button"
                    onClick={resetAction}
                    disabled={actionLoading}
                    className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-semibold px-4 py-2 rounded-md transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions — approved */}
        {status === 'approved' && (
          <div>
            {actionMode === 'idle' && (
              <button
                type="button"
                onClick={() => { setActionError(''); setActionMode('void-form'); }}
                className="w-full border border-red-600 text-red-600 hover:bg-red-50 text-sm font-semibold px-4 py-2 rounded-md transition"
              >
                Void Payment
              </button>
            )}

            {actionMode === 'void-form' && (
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Void reason (required)</p>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white mb-3"
                  placeholder="Enter reason for voiding…"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleVoid}
                    disabled={actionLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-md transition"
                  >
                    {actionLoading ? 'Voiding…' : 'Confirm Void'}
                  </button>
                  <button
                    type="button"
                    onClick={resetAction}
                    disabled={actionLoading}
                    className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-semibold px-4 py-2 rounded-md transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No actions */}
        {(status === 'rejected' || status === 'voided') && (
          <p className="text-sm text-gray-400 text-center py-2">No actions available.</p>
        )}

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: '24px',
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            background: '#E8A93D',
            color: '#fff',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>

      </div>
    </div>
  );
}

export default PaymentDetailModal;
