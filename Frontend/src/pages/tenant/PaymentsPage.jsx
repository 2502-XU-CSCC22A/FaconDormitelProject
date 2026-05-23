import { useState, useEffect, useCallback, useMemo } from 'react';
import { getUser, authHeader } from '../../utils/auth';
import SubmitPaymentModal from '../../components/tenant/SubmitPaymentModal';

const API = import.meta.env.VITE_API_BASE;

function ProofImage({ proofImagePath }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!proofImagePath) return;
    let revoked = false;
    let objectUrl = null;
    (async () => {
      try {
        const res = await fetch(`${API}/uploads/${proofImagePath}`, { headers: { ...authHeader() } });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        if (!revoked) { objectUrl = URL.createObjectURL(blob); setSrc(objectUrl); }
      } catch { if (!revoked) setError(true); }
    })();
    return () => { revoked = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [proofImagePath]);
  if (error) return <div className="text-sm text-red-500">Failed to load proof image.</div>;
  if (!src) return <div className="text-sm text-gray-400">Loading proof…</div>;
  return <img src={src} alt="Payment proof" className="max-w-full max-h-64 rounded border border-gray-200 mx-auto" />;
}

function fmt(n) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatMonth(yyyyMM) {
  const [y, m] = yyyyMM.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-PH', { month: 'long', year: 'numeric' });
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_STYLES = {
  submitted: 'bg-blue-100 text-blue-800',
  approved:  'bg-green-100 text-green-800',
  rejected:  'bg-red-100 text-red-700',
  voided:    'bg-gray-100 text-gray-700',
};

function StatusBadge({ status }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
}

function PaymentsPage() {
  const user = useMemo(() => getUser(), []);
  const [payments, setPayments] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const today = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [paymentsRes, billsRes] = await Promise.all([
        fetch(`${API}/api/me/payments`, { headers: { ...authHeader() } }),
        fetch(`${API}/api/me/bills`,    { headers: { ...authHeader() } }),
      ]);
      const [paymentsData, billsData] = await Promise.all([paymentsRes.json(), billsRes.json()]);
      if (!paymentsRes.ok) throw new Error(paymentsData.message || 'Failed to load payments.');
      if (!billsRes.ok)    throw new Error(billsData.message    || 'Failed to load bills.');
      setPayments(paymentsData.payments ?? []);
      setBills(billsData.bills ?? []);
    } catch (err) {
      setError(err.message || 'Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const billMap = useMemo(() => {
    const map = {};
    bills.forEach(b => { map[b._id] = b; });
    return map;
  }, [bills]);

  const totalSubmitted = payments.length;
  const pendingReview  = payments.filter(p => p.status === 'submitted').length;
  const approved       = payments.filter(p => p.status === 'approved').length;
  const rejected       = payments.filter(p => p.status === 'rejected').length;

  const toggleExpand = (id) => setExpanded(prev => prev === id ? null : id);

  return (
    <div className="min-h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500">Your payment submissions</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{today}</span>
          <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-xs font-bold shrink-0">{initials}</div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">Loading payments…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-600 text-sm">{error}</div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total submitted</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{totalSubmitted}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Pending review</p>
                <p className={`text-2xl font-bold mt-1 ${pendingReview > 0 ? 'text-blue-600' : 'text-gray-900'}`}>{pendingReview}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Approved</p>
                <p className={`text-2xl font-bold mt-1 ${approved > 0 ? 'text-green-600' : 'text-gray-900'}`}>{approved}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Rejected</p>
                <p className={`text-2xl font-bold mt-1 ${rejected > 0 ? 'text-red-600' : 'text-gray-900'}`}>{rejected}</p>
              </div>
            </div>

            {/* Submit payment banner */}
            <div className="bg-orange-50 border-2 border-dashed border-brand-orange rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">Have a receipt to submit?</p>
                <p className="text-xs text-gray-500 mt-0.5">Upload your proof of payment and we'll notify the owner for review.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="ml-4 shrink-0 px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs font-semibold rounded-lg transition"
              >
                Submit payment
              </button>
            </div>

            {/* Payment history */}
            {payments.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
                <p className="text-lg font-semibold text-gray-700">No payment submissions yet</p>
                <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
                  Your payment submissions will appear here after you upload proof of payment.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-700">Payment history</h2>
                </div>
                {/* Table header */}
                <div
                  className="grid text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100 px-5 py-2.5"
                  style={{ gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1fr 1.5rem' }}
                >
                  <div>Bill</div>
                  <div className="text-right">Amount</div>
                  <div className="text-right">Payment date</div>
                  <div className="text-right">Submitted</div>
                  <div className="text-right">Status</div>
                  <div />
                </div>
                <div className="divide-y divide-gray-100">
                  {payments.map(payment => {
                    const bill = billMap[payment.billId];
                    const isOpen = expanded === payment._id;
                    return (
                      <div key={payment._id}>
                        <div
                          className="grid items-center px-5 py-3.5 text-sm cursor-pointer hover:bg-gray-50 transition"
                          style={{ gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1fr 1.5rem' }}
                          onClick={() => toggleExpand(payment._id)}
                        >
                          <div className="font-medium text-gray-800">
                            {bill
                              ? `${bill.roomNameSnapshot} — ${formatMonth(bill.billingMonth)}`
                              : '—'}
                          </div>
                          <div className="text-right text-gray-600">₱{fmt(payment.amount)}</div>
                          <div className="text-right text-gray-500 text-xs">{formatDate(payment.paymentDate)}</div>
                          <div className="text-right text-gray-500 text-xs">{formatDate(payment.submittedAt)}</div>
                          <div className="flex justify-end">
                            <StatusBadge status={payment.status} />
                          </div>
                          <div className="text-gray-400 text-xs text-right select-none">{isOpen ? '▲' : '▼'}</div>
                        </div>
                        {isOpen && (
                          <div className="px-5 pb-5 pt-2 bg-gray-50 border-t border-gray-100 space-y-3">
                            {payment.rejectReason && (
                              <p className="text-xs text-red-600">
                                <span className="font-semibold">Reject reason: </span>{payment.rejectReason}
                              </p>
                            )}
                            {payment.voidReason && (
                              <p className="text-xs text-gray-500">
                                <span className="font-semibold">Void reason: </span>{payment.voidReason}
                              </p>
                            )}
                            <div>
                              <p className="text-xs text-gray-400 mb-2 font-medium">Proof of payment</p>
                              {payment.proofImagePath
                                ? <ProofImage proofImagePath={payment.proofImagePath} />
                                : <p className="text-xs text-gray-400">No proof image attached.</p>
                              }
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <SubmitPaymentModal
          bills={bills}
          user={user}
          onClose={() => setShowModal(false)}
          onSubmitted={() => { setShowModal(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

export default PaymentsPage;
