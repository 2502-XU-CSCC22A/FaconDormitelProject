// src/pages/tenant/PaymentsPage.jsx
// TODO Phase 3 — payment tracker (needs GET /api/me/payments)
import { getUser } from '../../utils/auth';
import { useMemo } from 'react';

function PaymentsPage() {
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
          <h1 className="text-lg font-bold text-gray-900">Payment tracker</h1>
          <p className="text-sm text-gray-500">Your payment history</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{today}</span>
          <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center py-20 text-gray-400 text-sm">
        Coming soon — Phase 3 (requires payments backend)
      </div>
    </div>
  );
}

export default PaymentsPage;
