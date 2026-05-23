import { useState, useEffect, useRef, useMemo } from 'react';
import { authHeader } from '../../utils/auth';

const API = 'http://localhost:5000';

const UNPAID_STATUSES = new Set(['pending', 'overdue', 'unpaid']);

function fmt(n) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatMonth(yyyyMM) {
  const [y, m] = yyyyMM.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-PH', { month: 'long', year: 'numeric' });
}

function SubmitPaymentModal({ bills, user, onClose, onSubmitted }) {
  const unpaidOptions = useMemo(() =>
    bills.flatMap(bill => {
      const share =
        bill.shares.find(s => s.tenantId && s.tenantId.toString() === user?._id?.toString())
        ?? bill.shares[0];
      if (!share || !UNPAID_STATUSES.has(share.status)) return [];
      return [{ bill, share }];
    }),
    [bills, user]
  );

  const [selectedShareId, setSelectedShareId] = useState(unpaidOptions[0]?.share._id ?? '');
  const selectedOpt = unpaidOptions.find(o => o.share._id === selectedShareId) ?? unpaidOptions[0] ?? null;

  const [amount, setAmount] = useState(selectedOpt?.share.amount?.toString() ?? '');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [sizeWarning, setSizeWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setAmount(selectedOpt?.share.amount?.toString() ?? '');
  }, [selectedShareId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setSizeWarning(f.size > 5 * 1024 * 1024);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOpt) { setError('Please select a bill.'); return; }
    if (!file) { setError('Please attach a proof of payment image.'); return; }
    if (!amount || Number(amount) <= 0) { setError('Amount must be greater than 0.'); return; }

    setSubmitting(true);
    setError('');

    const form = new FormData();
    form.append('shareId', selectedOpt.share._id);
    form.append('amount', amount);
    form.append('paymentDate', paymentDate);
    form.append('proof', file);

    try {
      const res = await fetch(`${API}/api/me/payments`, {
        method: 'POST',
        headers: { ...authHeader() },
        body: form,
      });
      const data = await res.json();
      if (res.status === 409) {
        setError('You already have a pending submission for this bill. Wait for owner review.');
      } else if (!res.ok) {
        setError(data.message || 'Submission failed. Please try again.');
      } else {
        onSubmitted();
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Submit payment</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Bill selection */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Bill</label>
            {unpaidOptions.length === 0 ? (
              <p className="text-sm text-gray-500">No unpaid bills to submit payment for.</p>
            ) : (
              <select
                value={selectedShareId}
                onChange={e => setSelectedShareId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white"
              >
                {unpaidOptions.map(({ bill, share }) => (
                  <option key={share._id} value={share._id}>
                    {bill.roomNameSnapshot ?? 'Room'} — {formatMonth(bill.billingMonth)} — ₱{fmt(share.amount)} ({share.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Amount (₱)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-orange"
              placeholder="0.00"
            />
          </div>

          {/* Payment date */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Payment date</label>
            <input
              type="date"
              value={paymentDate}
              max={today}
              onChange={e => setPaymentDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>

          {/* File upload */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Proof of payment</label>
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-brand-orange transition"
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="max-h-40 mx-auto rounded object-contain" />
              ) : (
                <p className="text-gray-400 text-sm">Click to upload proof image</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {file && <p className="text-xs text-gray-500 mt-1">{file.name}</p>}
            {sizeWarning && (
              <p className="text-xs text-amber-600 mt-1">File is large (&gt;5 MB). Upload may be slow.</p>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || unpaidOptions.length === 0}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-brand-orange hover:bg-brand-orange-dark text-white transition disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SubmitPaymentModal;
