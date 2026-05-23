// src/components/admin/BillDetailModal.jsx
import { useState, useEffect, useCallback } from 'react';
import { authHeader } from '../../utils/auth';
import { getBillDisplayStatus, getShareDisplayStatus } from '../../utils/billStatus';

const API = import.meta.env.VITE_API_BASE;

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
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
  maxWidth: '560px',
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

function fmt(n) {
  return Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function BillStatusBadge({ bill }) {
  const status = getBillDisplayStatus(bill);
  if (status === 'fully-paid') {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
        Fully Paid
      </span>
    );
  }
  if (status === 'overdue') {
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

function ShareStatusBadge({ share }) {
  const displayStatus = getShareDisplayStatus(share);
  if (displayStatus === 'paid') {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
        Settled
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

function BillDetailModal({ billId, onClose, onBillUpdated }) {
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingShareId, setMarkingShareId] = useState(null);
  const [shareMsg, setShareMsg] = useState('');

  const fetchBill = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/admin/bills/${billId}`, {
        headers: { ...authHeader() }
      });
      const data = await res.json();
      if (res.ok) {
        setBill(data.bill);
      } else {
        setError(data.message || 'Failed to load bill.');
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  }, [billId]);

  useEffect(() => {
    fetchBill();
  }, [fetchBill]);

  const handleMarkPaid = async (shareId) => {
    setMarkingShareId(shareId);
    setShareMsg('');
    try {
      const res = await fetch(`${API}/api/admin/bills/${billId}/shares/${shareId}/pay`, {
        method: 'POST',
        headers: { ...authHeader() }
      });
      const data = await res.json();
      if (!res.ok) {
        setShareMsg(data.message || 'Could not mark share as paid.');
      }
      // Refresh in both 200 and 400-already-paid cases to keep UI in sync
      await fetchBill();
      if (onBillUpdated) onBillUpdated();
    } catch {
      setShareMsg('Failed to connect to the server.');
    } finally {
      setMarkingShareId(null);
    }
  };

  const kWh = bill
    ? bill.electricity.currentReading - bill.electricity.previousReading
    : 0;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>

        {/* Title bar */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">Bill Details</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none"
          >
            ×
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
        )}

        {/* Error */}
        {!loading && error && (
          <p className="text-sm text-red-600 py-4 text-center">{error}</p>
        )}

        {/* Content */}
        {!loading && bill && (
          <>
            {/* Header card */}
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 mb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
                    {bill.roomNameSnapshot}
                  </p>
                  <p className="font-bold text-lg leading-tight">
                    {formatMonth(bill.billingMonth)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Due {formatDate(bill.dueDate)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-brand-orange">
                    ₱{fmt(bill.totalAmount)}
                  </p>
                  <div className="mt-1">
                    <BillStatusBadge bill={bill} />
                  </div>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="border border-gray-100 rounded-lg p-4 mb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Breakdown
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Flat Fee</span>
                  <span>₱{fmt(bill.flatFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Electricity</span>
                  <span>
                    ₱{fmt(bill.electricity.amount)}
                    <span className="text-xs text-gray-400 ml-1">
                      ({kWh} kWh × ₱{bill.electricity.ratePerKwh})
                    </span>
                  </span>
                </div>
                <div className="flex justify-between font-semibold border-t border-gray-100 pt-2 mt-1">
                  <span>Total</span>
                  <span>₱{fmt(bill.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Shares */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Tenant Shares ({bill.shares.length})
              </p>

              {shareMsg && (
                <div className="border border-amber-200 bg-amber-50 rounded-md px-3 py-2 text-sm text-amber-800 mb-3">
                  {shareMsg}
                </div>
              )}

              <div className="space-y-2">
                {bill.shares.map((share) => (
                  <div
                    key={share._id}
                    className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {share.tenantName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {share.tenantEmail}
                      </p>
                      {(share.status === 'paid' || share.status === 'settled') && share.paidAt && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Paid {formatDate(share.paidAt)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold">₱{fmt(share.amount)}</p>
                        <ShareStatusBadge share={share} />
                      </div>

                      {(share.status === 'pending' || share.status === 'overdue' || share.status === 'unpaid') && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(share._id)}
                          disabled={markingShareId === share._id}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition ${
                            markingShareId === share._id
                              ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                              : 'border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white'
                          }`}
                        >
                          {markingShareId === share._id ? '…' : 'Mark Paid'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
          </>
        )}

      </div>
    </div>
  );
}

export default BillDetailModal;
