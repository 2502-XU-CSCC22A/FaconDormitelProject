// src/components/admin/CreateBillModal.jsx
import { useState, useEffect } from 'react';
import { authHeader } from '../../utils/auth';

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
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
  position: 'relative'
};

function toMonthValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toDateValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(n) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CreateBillModal({ onClose, onSuccess }) {
  // Rooms
  const [rooms, setRooms] = useState([]);
  const [roomsStatus, setRoomsStatus] = useState('loading'); // 'loading' | 'ok' | 'empty' | 'unavailable'

  // Form fields — defaults computed at render time so they stay fresh
  const [roomId, setRoomId] = useState('');
  const [billingMonth, setBillingMonth] = useState(() => toMonthValue(new Date()));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return toDateValue(d);
  });
  const [flatFee, setFlatFee] = useState('7500');
  const [prevReading, setPrevReading] = useState('');
  const [currReading, setCurrReading] = useState('');
  const [ratePerKwh, setRatePerKwh] = useState('14');

  // Submit
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/admin/rooms`, { headers: { ...authHeader() } });
        if (!res.ok) { setRoomsStatus('unavailable'); return; }
        const data = await res.json();
        const list = data.rooms ?? data;
        if (!Array.isArray(list) || list.length === 0) { setRoomsStatus('empty'); return; }
        setRooms(list);
        setRoomId(list[0]._id);
        setRoomsStatus('ok');
      } catch {
        setRoomsStatus('unavailable');
      }
    };
    load();
  }, []);

  // Live preview
  const prevR = prevReading !== '' ? Number(prevReading) : 0;
  const currR = currReading !== '' ? Number(currReading) : 0;
  const flat = Number(flatFee) || 0;
  const rate = Number(ratePerKwh) || 0;
  const kWh = Math.max(0, currR - prevR);
  const elecAmount = kWh * rate;
  const total = flat + elecAmount;
  const selectedRoom = rooms.find(r => r._id === roomId);
  const occupants = selectedRoom?.occupantCount ?? null;
  const perTenant = occupants > 0 ? total / occupants : null;

  const readingInvalid = currReading !== '' && Number(currReading) < prevR;
  const canSubmit =
    roomsStatus === 'ok' &&
    roomId &&
    billingMonth &&
    currReading !== '' &&
    !readingInvalid &&
    Number(flatFee) >= 0 &&
    Number(ratePerKwh) >= 0 &&
    !isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const electricity = {
        currentReading: Number(currReading),
        ratePerKwh: Number(ratePerKwh)
      };
      if (prevReading !== '') electricity.previousReading = Number(prevReading);

      const res = await fetch(`${API}/api/admin/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          roomId,
          billingMonth,
          dueDate,
          flatFee: Number(flatFee),
          electricity
        })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setSubmitError(data.message || 'Failed to create bill.');
      }
    } catch {
      setSubmitError('Failed to connect to the server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>

        {/* Title */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">Create Bill</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none">×</button>
        </div>

        {/* Rooms unavailable banner */}
        {(roomsStatus === 'unavailable' || roomsStatus === 'empty') && (
          <div className="border border-amber-300 bg-amber-50 rounded-md px-4 py-3 mb-5 text-sm text-amber-800">
            {roomsStatus === 'empty'
              ? 'No rooms have been created yet. Add rooms before creating a bill.'
              : 'No rooms available yet — waiting for room module.'}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* ── Section A: Bill Info ───────────────────── */}
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Bill Info</p>

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={roomsStatus !== 'ok'}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {roomsStatus === 'loading' && <option>Loading…</option>}
              {roomsStatus !== 'loading' && roomsStatus !== 'ok' && <option>No rooms available</option>}
              {rooms.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name || r.roomNumber}
                  {r.occupantCount != null ? ` — ${r.occupantCount} occupant${r.occupantCount !== 1 ? 's' : ''}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing Month</label>
              <input
                type="month"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>
          </div>

          {/* ── Section B: Fixed Fees ──────────────────── */}
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Fixed Fees</p>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Flat Rate (₱)
              <span className="ml-2 text-xs font-normal text-gray-400">Rent + Water + WiFi</span>
            </label>
            <input
             type="number"
             value={flatFee}
             onChange={(e) => setFlatFee(e.target.value)}
             min="0"
             step="0.01"
              required
             className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
             />
          </div>

          {/* ── Section C: Electricity ─────────────────── */}
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Electricity</p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prev. Reading</label>
              <input
               type="number"
               value={prevReading}
               onChange={(e) => setPrevReading(e.target.value)}
               min="0"
               step="0.01"
               placeholder="Auto"
               className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
               />
              <p className="text-xs text-gray-400 mt-1">Blank = auto-fill</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Curr. Reading <span className="text-red-400">*</span></label>
              <input
               type="number"
               value={currReading}
               onChange={(e) => setCurrReading(e.target.value)}
              min="0"
              step="0.01"
               required
              className={`w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange ${readingInvalid ? 'border-red-400' : 'border-gray-300'}`}
/>
              {readingInvalid && <p className="text-xs text-red-500 mt-1">Must be ≥ previous</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate (₱/kWh)</label>
              <input
                type="number"
                value={ratePerKwh}
                onChange={(e) => setRatePerKwh(e.target.value)}
                min="0"
                step="0.01"
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>
          </div>

          {/* ── Live Preview ───────────────────────────── */}
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Preview</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Flat Fee</span>
                <span>₱{fmt(flat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Electricity</span>
                <span>
                  ₱{fmt(elecAmount)}
                  <span className="text-xs text-gray-400 ml-1">({kWh} kWh × ₱{rate})</span>
                </span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-orange-200 pt-2 mt-1">
                <span>Total</span>
                <span className="text-brand-orange">₱{fmt(total)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Per tenant</span>
                <span>
                  {perTenant !== null
                    ? `≈₱${fmt(perTenant)} (${occupants} tenant${occupants !== 1 ? 's' : ''})`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-red-600 mb-3">{submitError}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${canSubmit ? 'bg-brand-orange hover:bg-brand-orange-dark text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            >
              {isSubmitting ? 'Creating…' : 'Create Bill'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
            >
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default CreateBillModal;
