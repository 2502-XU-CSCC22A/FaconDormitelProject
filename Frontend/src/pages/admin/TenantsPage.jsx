// src/pages/admin/TenantsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { authHeader } from '../../utils/auth';
import InviteLinkModal from '../../components/admin/InviteLinkModal';
import iconTenants from '../../assets/BigTenant2.png';

const API_BASE = 'http://localhost:5000/api/admin/tenants';
const ROOMS_API = 'http://localhost:5000/api/admin/rooms';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function TenantsPage() {
  // Tenant list state
  const [tenants, setTenants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Rooms for assignment
  const [rooms, setRooms] = useState([]);

  // Add Tenant form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRoomId, setFormRoomId] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite modal state - populated after a successful create
  const [inviteResult, setInviteResult] = useState(null);

  // Delete tenant modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteBlocked, setDeleteBlocked] = useState(null); // { unpaidCount, unpaidTotal } | null
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch tenants
  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const response = await fetch(API_BASE, {
        headers: { ...authHeader() }
      });
      const data = await response.json();
      if (response.ok) {
        setTenants(data.tenants || []);
      } else {
        setLoadError(data.message || 'Failed to load tenants');
      }
    } catch (err) {
      console.error('Fetch tenants error:', err);
      setLoadError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  useEffect(() => {
    fetch(ROOMS_API, { headers: { ...authHeader() } })
      .then(r => r.json())
      .then(data => setRooms(data.rooms ?? []))
      .catch(() => {});
  }, []);

  // Form handlers
  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormRoomId('');
    setFormError('');
  };

  const handleOpenForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleCancelForm = () => {
    resetForm();
    setIsFormOpen(false);
  };

  const trimmedName = formName.trim();
  const canSubmit = trimmedName.length >= 2 && isValidEmail(formEmail) && !isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim(),
          ...(formRoomId ? { roomId: formRoomId } : {})
        })
      });
      const data = await response.json();

      if (response.ok) {
        // Success: close form, show modal, refresh list
        resetForm();
        setIsFormOpen(false);
        setInviteResult(data);
        fetchTenants();
      } else {
        setFormError(data.message || 'Failed to invite tenant.');
      }
    } catch (err) {
      console.error('Invite tenant error:', err);
      setFormError('Failed to connect to the server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (tenant) => {
    setDeleteTarget(tenant);
    setDeleteError('');
    setDeleteBlocked(null);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteError('');
    setDeleteBlocked(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    setDeleteBlocked(null);
    try {
      const response = await fetch(`${API_BASE}/${deleteTarget._id}`, {
        method: 'DELETE',
        headers: { ...authHeader() }
      });
      const data = await response.json();
      if (response.ok) {
        closeDeleteModal();
        fetchTenants();
      } else if (response.status === 409) {
        setDeleteBlocked({ unpaidCount: data.unpaidCount, unpaidTotal: data.unpaidTotal });
      } else {
        setDeleteError(data.message || 'Failed to remove tenant.');
      }
    } catch (err) {
      console.error('Delete tenant error:', err);
      setDeleteError('Failed to connect to the server.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Render helper
  const renderStatusBadge = (status) => {
    if (status === 'active') {
      return (
        <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
          Active
        </span>
      );
    }
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
        Pending
      </span>
    );
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Tenant Management</h2>
        {!isFormOpen && (
          <button
            type="button"
            onClick={handleOpenForm}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold px-4 py-2 rounded-md transition"
          >
            + Add Tenant
          </button>
        )}
      </div>

      {/* Add Tenant form (toggled) */}
      {isFormOpen && (
        <div className="border border-gray-300 rounded-lg p-5 mb-6 bg-gray-50">
          <h3 className="font-semibold mb-4">New Tenant</h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="t-name">
                Name
              </label>
              <input
                 id="t-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Full name (minimum 2 characters)"
                required
                 minLength={2}
                 className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
                 />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="t-email">
                Email
              </label>
              <input
                id="t-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="t-room">
                Assign to Room
              </label>
              <select
                id="t-room"
                value={formRoomId}
                onChange={(e) => setFormRoomId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
              >
                <option value="">No Room (Unassigned)</option>
                {rooms.map((r) => {
                  const full = (r.currentOccupants ?? 0) >= r.capacity;
                  return (
                    <option key={r._id} value={r._id} disabled={full}>
                      Room {r.roomNumber} ({r.currentOccupants ?? 0}/{r.capacity}){full ? ' — Full' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {formError && (
              <p className="text-red-600 text-sm mb-3">{formError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className={
                  'px-4 py-2 text-sm font-semibold rounded-md transition ' +
                  (canSubmit
                    ? 'bg-brand-orange hover:bg-brand-orange-dark text-white'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed')
                }
              >
                {isSubmitting ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tenants table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="bg-orange-50 px-4 py-3 grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700">
          <div className="col-span-3">Name</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-2">Room</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">
            Loading tenants...
          </div>
        ) : loadError ? (
          <div className="px-4 py-12 text-center text-red-600 text-sm">
            {loadError}
          </div>
        ) : tenants.length === 0 ? (
          <div className="px-4 py-12">
            <div className="border-2 border-dashed border-gray-300 rounded-lg py-12 text-center">
              <div className="flex justify-center mb-3">
                <img src={iconTenants} alt="" className="w-16 h-16 opacity-50" />
              </div>
              <p className="text-sm text-gray-500">
                No tenants registered yet. Click "Add Tenant" to get started.
              </p>
            </div>
          </div>
        ) : (
          tenants.map((t) => (
            <div
              key={t._id}
              className="px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm border-t border-gray-100 hover:bg-gray-50"
            >
              <div className="col-span-3 truncate">
                {t.name || <span className="text-gray-400 italic">(no name)</span>}
              </div>
              <div className="col-span-4 truncate">{t.email}</div>
              <div className="col-span-2 text-gray-500">
                {t.room
                  ? <span className="font-medium text-gray-800">{t.room.roomNumber}</span>
                  : <span className="italic">Unassigned</span>}
              </div>
              <div className="col-span-2">{renderStatusBadge(t.status)}</div>
              <div className="col-span-1 text-right">
                <button
                  type="button"
                  onClick={() => openDeleteModal(t)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium transition"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold mb-3">Remove Tenant</h3>

            {deleteBlocked ? (
              <>
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <strong>{deleteTarget.name || deleteTarget.email}</strong> has{' '}
                  {deleteBlocked.unpaidCount} unpaid bill{deleteBlocked.unpaidCount !== 1 ? 's' : ''}{' '}
                  totaling ₱{deleteBlocked.unpaidTotal.toLocaleString()}. Mark bills paid first.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-700 mb-4">
                  Are you sure you want to remove{' '}
                  <strong>{deleteTarget.name || '(no name)'}</strong>{' '}
                  ({deleteTarget.email})? This cannot be undone.
                </p>
                {deleteError && (
                  <p className="text-red-600 text-sm mb-3">{deleteError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50"
                  >
                    {isDeleting ? 'Removing...' : 'Confirm'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

       {inviteResult && (
      <InviteLinkModal
       tenant={inviteResult.tenant}
       inviteLink={inviteResult.inviteLink}
       inviteExpiresAt={inviteResult.inviteExpiresAt}
       emailSent={inviteResult.emailSent}
       emailError={inviteResult.emailError}
      onClose={() => setInviteResult(null)}
       />
)}
    </div>
  );
}

export default TenantsPage;