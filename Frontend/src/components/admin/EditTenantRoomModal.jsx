// src/components/admin/EditTenantRoomModal.jsx
import { useState } from 'react';
import { authHeader } from '../../utils/auth';

const API = 'http://localhost:5000';

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
  maxWidth: '480px',
  width: '100%',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
  position: 'relative'
};

function EditTenantRoomModal({ tenant, rooms, onClose, onSaved }) {
  const currentRoomId = tenant.room?._id ?? '';
  const [selectedRoomId, setSelectedRoomId] = useState(currentRoomId);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setError('');
    setIsSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/tenants/${tenant._id}/room`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ roomId: selectedRoomId || null })
      });
      const data = await res.json();
      if (res.ok) {
        onSaved();
      } else {
        setError(data.message || 'Failed to update room assignment.');
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">Edit Room Assignment</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none"
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-1">Tenant</p>
          <p className="text-sm font-medium text-gray-800">{tenant.name || tenant.email}</p>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-room">
            Assign to Room
          </label>
          <select
            id="edit-room"
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
          >
            <option value="">(Unassigned)</option>
            {rooms.map((r) => {
              const full = (r.currentOccupants ?? 0) >= r.capacity;
              const isCurrent = r._id === currentRoomId;
              return (
                <option key={r._id} value={r._id} disabled={full && !isCurrent}>
                  Room {r.roomNumber} ({r.currentOccupants ?? 0}/{r.capacity}){full && !isCurrent ? ' — Full' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${isSaving ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-brand-orange hover:bg-brand-orange-dark text-white'}`}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}

export default EditTenantRoomModal;
