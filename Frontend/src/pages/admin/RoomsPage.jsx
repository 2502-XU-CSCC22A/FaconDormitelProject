import { useState, useEffect } from 'react';
import { authHeader } from '../../utils/auth';
import emptyStateImage from '../../assets/SVG.png';

const API_BASE = 'http://localhost:5000/api/rooms';

function RoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [selectedRoomToDelete, setSelectedRoomToDelete] = useState(null);
  const [formError, setFormError] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const resetForm = () => {
    setRoomNumber('');
    setCapacity('');
    setFormError('');
  };

  const handleOpenForm = () => {
    resetForm();
    setSuccessMessage('');
    setIsFormOpen(true);
  };

  const handleCancelForm = () => {
    resetForm();
    setIsFormOpen(false);
  };

  const trimmedRoomNumber = roomNumber.trim();
  const parsedCapacity = parseInt(capacity, 10);
  const canSubmit = trimmedRoomNumber.length > 0 && parsedCapacity >= 1 && !isSubmitting;

  const fetchRooms = async () => {
    try {
      const response = await fetch(API_BASE, {
        headers: { ...authHeader() },
      });
      const data = await response.json();
      if (response.ok) {
        setRooms(data.rooms || []);
        setFetchError('');
      } else {
        setFetchError(data.message || 'Unable to load rooms.');
        setRooms([]);
      }
    } catch (error) {
      console.error('Fetch rooms error:', error);
      setFetchError('Unable to load rooms. Please check your connection.');
      setRooms([]);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ roomNumber: trimmedRoomNumber, capacity: parsedCapacity }),
      });
      const data = await response.json();

      if (response.ok) {
        await fetchRooms();
        setSuccessMessage('Room created successfully.');
        resetForm();
        setIsFormOpen(false);
      } else {
        setFormError(data.message || 'Failed to save room.');
      }
    } catch (error) {
      console.error('Create room error:', error);
      setFormError('Failed to connect to the server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteConfirmation = (room) => {
    setSelectedRoomToDelete(room);
    setDeleteConfirmationOpen(true);
    setFormError('');
    setSuccessMessage('');
  };

  const closeDeleteConfirmation = () => {
    setDeleteConfirmationOpen(false);
    setSelectedRoomToDelete(null);
  };

  const handleDelete = async () => {
    if (!selectedRoomToDelete) {
      return;
    }

    setFormError('');
    setSuccessMessage('');
    setIsDeleting(true);
    setDeletingRoomId(selectedRoomToDelete._id);

    try {
      const response = await fetch(`${API_BASE}/${selectedRoomToDelete._id}`, {
        method: 'DELETE',
        headers: { ...authHeader() },
      });
      const data = await response.json();

      if (response.ok) {
        await fetchRooms();
        setSuccessMessage(data.message || 'Room removed successfully.');
        closeDeleteConfirmation();
      } else {
        setFormError(data.message || 'Failed to remove room.');
      }
    } catch (error) {
      console.error('Delete room error:', error);
      setFormError('Failed to connect to the server.');
    } finally {
      setIsDeleting(false);
      setDeletingRoomId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Room Management</h2>
        {!isFormOpen && (
          <button
            type="button"
            onClick={handleOpenForm}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold px-4 py-2 rounded-md transition"
          >
            + Add Room
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className="border border-brand-orange rounded-lg p-6 mb-6 bg-orange-50 shadow-sm">
          <h3 className="font-semibold text-lg mb-4">New Room</h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="room-number" className="block text-sm font-medium text-gray-700 mb-1">
                Room Name
              </label>
              <input
                id="room-number"
                type="text"
                value={roomNumber}
                onChange={(event) => setRoomNumber(event.target.value)}
                placeholder="e.g., Room 101"
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-1">
                Capacity
              </label>
              <input
                id="capacity"
                type="number"
                value={capacity}
                min={1}
                onChange={(event) => setCapacity(event.target.value)}
                placeholder="1"
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>

            {formError && <p className="text-red-600 text-sm mb-4">{formError}</p>}

            <div className="flex gap-3">
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

      {successMessage && (
        <div className="mb-6 rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-8 bg-white">
        {fetchError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            <p className="font-semibold">Unable to load rooms</p>
            <p>{fetchError}</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg py-16 text-center text-gray-500">
            <div className="flex justify-center mb-4">
              <img src={emptyStateImage} alt="No rooms illustration" className="h-16 w-16 object-contain" />
            </div>
            <p className="text-base font-medium mb-2">No rooms created yet.</p>
            <p className="text-sm">Click "Add Room" to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map((room) => (
              <div key={room._id || room.roomNumber} className="border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500">Room</p>
                    <p className="text-lg font-semibold truncate">{room.roomNumber}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500">Capacity</p>
                    <p className="text-lg font-semibold">{room.capacity}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="text-lg font-semibold capitalize">{room.status || 'available'}</p>
                  </div>
                  <div className="flex justify-start sm:justify-end items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openDeleteConfirmation(room)}
                      disabled={isDeleting && deletingRoomId === room._id}
                      className={`px-3 py-1 text-sm font-semibold rounded-md transition ${isDeleting && deletingRoomId === room._id ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                    >
                      {isDeleting && deletingRoomId === room._id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteConfirmationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10">
            <h3 className="text-lg font-semibold text-gray-900">Confirm remove room</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to remove <span className="font-semibold text-gray-900">{selectedRoomToDelete?.roomNumber}</span>?
              This action cannot be undone.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteConfirmation}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${isDeleting ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
              >
                {isDeleting ? 'Removing…' : 'Remove room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoomsPage;
