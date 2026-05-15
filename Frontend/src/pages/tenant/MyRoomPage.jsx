// src/pages/tenant/MyRoomPage.jsx
// TODO Phase 2 — room details + roommates
import { getUser } from '../../utils/auth';
import { useMemo } from 'react';

function MyRoomPage() {
  const user = useMemo(() => getUser(), []);
  const today = new Date().toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="min-h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">My Room</h1>
          <p className="text-sm text-gray-500">Room details &amp; roommates</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{today}</span>
          <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center py-20 text-gray-400 text-sm">
        Coming soon — Phase 2
      </div>
    </div>
  );
}

export default MyRoomPage;
