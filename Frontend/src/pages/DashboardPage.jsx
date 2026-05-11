// src/pages/DashboardPage.jsx
//
// Tenant landing page (role: client). Fetches and displays the tenant's bills.
// Owners are bounced to /admin/tenants by the useEffect below.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logout, authHeader } from '../utils/auth';
import logoImage from '../assets/logo.png';

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

function ShareStatusBadge({ share }) {
  if (share.status === 'paid') {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
        Paid
      </span>
    );
  }
  if (share.overdue) {
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

function DashboardPage() {
  const navigate = useNavigate();
  const user = getUser();

  const [bills, setBills] = useState([]);
  const [arrears, setArrears] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (user?.role === 'owner') {
      navigate('/admin/tenants', { replace: true });
    }
  }, [user, navigate]);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`${API}/api/me/bills`, {
        headers: { ...authHeader() }
      });
      const data = await res.json();
      if (res.ok) {
        setBills(data.bills ?? []);
        setArrears(data.arrears ?? 0);
        setTotalDue(data.totalDue ?? 0);
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
    if (user?.role !== 'owner') {
      fetchBills();
    }
  }, [fetchBills, user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const myShare = (bill) =>
    bill.shares.find(
      (s) => s.tenantId && s.tenantId.toString() === user?._id?.toString()
    ) ?? bill.shares[0];

  return (
    <div className="min-h-screen bg-peach flex flex-col">
      {/* Header */}
      <header className="bg-white border-b-2 border-brand-orange">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="RFacon Dormitel" className="h-10 w-auto" />
            <div>
              <h1 className="font-bold text-lg leading-tight">RFacon Dormitel</h1>
              <p className="text-xs text-gray-500">Tenant Portal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-brand-orange transition"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10">

        {/* Welcome */}
        <h2 className="text-2xl font-bold mb-6">
          Welcome{user?.name ? `, ${user.name}` : ''}!
        </h2>

        {/* Summary chips */}
        {!loading && !loadError && (
          <div className="flex flex-wrap gap-3 mb-8">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${
              arrears > 0
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}>
              <span>Arrears:</span>
              <span>₱{fmt(arrears)}</span>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${
              totalDue > 0
                ? 'bg-orange-50 border-orange-200 text-brand-orange'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}>
              <span>Total Due:</span>
              <span>₱{fmt(totalDue)}</span>
            </div>
          </div>
        )}

        {/* Bills list */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Table header */}
          <div className="bg-orange-50 px-5 py-3 grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700 border-b border-orange-100">
            <div className="col-span-3">Month</div>
            <div className="col-span-3">Room</div>
            <div className="col-span-2">Due</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-2 text-right">Status</div>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-gray-500 text-sm">
              Loading your bills…
            </div>
          ) : loadError ? (
            <div className="px-5 py-12 text-center text-red-600 text-sm">
              {loadError}
            </div>
          ) : bills.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-lg font-semibold text-gray-700 mb-1">No bills yet</p>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                Once your landlord assigns you to a room and creates a bill, it will appear here.
              </p>
            </div>
          ) : (
            bills.map((bill) => {
              const share = myShare(bill);
              const kWh =
                bill.electricity.currentReading - bill.electricity.previousReading;

              return (
                <details
                  key={bill._id}
                  className="border-t border-gray-100 group"
                >
                  {/* Summary row — click to expand breakdown */}
                  <summary className="px-5 py-3 grid grid-cols-12 gap-2 items-center text-sm cursor-pointer hover:bg-gray-50 transition list-none">
                    <div className="col-span-3 font-medium">
                      {formatMonth(bill.billingMonth)}
                    </div>
                    <div className="col-span-3 text-gray-600 truncate">
                      {bill.roomNameSnapshot}
                    </div>
                    <div className="col-span-2 text-gray-500">
                      {formatDate(bill.dueDate)}
                    </div>
                    <div className="col-span-2 text-right font-semibold">
                      {share ? `₱${fmt(share.amount)}` : '—'}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {share ? <ShareStatusBadge share={share} /> : null}
                    </div>
                  </summary>

                  {/* Expanded breakdown */}
                  <div className="bg-orange-50 border-t border-orange-100 px-5 py-4 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                      Breakdown
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Flat Fee (Rent + Water + WiFi)</span>
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
                      <div className="flex justify-between font-semibold border-t border-orange-200 pt-2 mt-1">
                        <span>Room Total</span>
                        <span>₱{fmt(bill.totalAmount)}</span>
                      </div>
                      {share && (
                        <div className="flex justify-between text-brand-orange font-bold text-base">
                          <span>Your Share</span>
                          <span>₱{fmt(share.amount)}</span>
                        </div>
                      )}
                      {share?.status === 'paid' && share.paidAt && (
                        <p className="text-xs text-green-600 mt-1">
                          Paid on {formatDate(share.paidAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </details>
              );
            })
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-500 py-6">
        <p>RFacon Dormitel © 2026</p>
        <p>Built with React & Tailwind CSS</p>
      </footer>
    </div>
  );
}

export default DashboardPage;
