// src/pages/admin/BillsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { authHeader } from '../../utils/auth';
import { getBillDisplayStatus } from '../../utils/billStatus';
import CreateBillModal from '../../components/admin/CreateBillModal';
import BillDetailModal from '../../components/admin/BillDetailModal';
import iconBills from '../../assets/BigBills2.png';

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

function BillStatusBadge({ bill }) {
  const status = getBillDisplayStatus(bill);
  if (status === 'fully-paid') {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
        Fully Paid
      </span>
    );
  }
  if (status === 'arrears') {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
        Arrears
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

function BillsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState(null);

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

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Bill Management</h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold px-4 py-2 rounded-md transition"
        >
          + Create Bill
        </button>
      </div>

      {/* Bills table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="bg-orange-50 px-4 py-3 grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700">
          <div className="col-span-3">Room</div>
          <div className="col-span-3">Billing Month</div>
          <div className="col-span-2">Due Date</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-2 text-right">Status</div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">
            Loading bills…
          </div>
        ) : loadError ? (
          <div className="px-4 py-12 text-center text-red-600 text-sm">
            {loadError}
          </div>
        ) : bills.length === 0 ? (
          <div className="px-4 py-12">
            <div className="border-2 border-dashed border-gray-300 rounded-lg py-12 text-center">
              <div className="flex justify-center mb-3">
                <img src={iconBills} alt="" className="w-16 h-16 opacity-50" />
              </div>
              <p className="text-sm text-gray-500">
                No bills yet. Click "+ Create Bill" to get started.
              </p>
            </div>
          </div>
        ) : (
          bills.map((bill) => (
            <button
              key={bill._id}
              type="button"
              onClick={() => setSelectedBillId(bill._id)}
              className="w-full text-left px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm border-t border-gray-100 hover:bg-gray-50 transition"
            >
              <div className="col-span-3 font-medium truncate">
                {bill.roomNameSnapshot}
              </div>
              <div className="col-span-3 text-gray-700">
                {formatMonth(bill.billingMonth)}
              </div>
              <div className="col-span-2 text-gray-500">
                {formatDate(bill.dueDate)}
              </div>
              <div className="col-span-2 text-right font-semibold">
                ₱{fmt(bill.totalAmount)}
              </div>
              <div className="col-span-2 flex justify-end">
                <BillStatusBadge bill={bill} />
              </div>
            </button>
          ))
        )}
      </div>

      {showCreate && (
        <CreateBillModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            fetchBills();
          }}
        />
      )}

      {selectedBillId && (
        <BillDetailModal
          billId={selectedBillId}
          onClose={() => setSelectedBillId(null)}
          onBillUpdated={fetchBills}
        />
      )}
    </div>
  );
}

export default BillsPage;
