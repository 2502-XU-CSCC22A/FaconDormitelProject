// Centralized bill/share status utilities used by all admin and tenant pages.
// Maps the backend status to display states:
//   'paid'    — share is paid or settled (terminal, green)
//   'arrears' — share is past grace period (arrears/unpaid backend status, orange)
//   'overdue' — share is within grace period past due (red)
//   'pending' — share is not yet past due (yellow)

export function getShareDisplayStatus(share) {
  const { status } = share;
  if (status === 'paid' || status === 'settled') return 'paid';
  if (status === 'arrears' || status === 'unpaid') return 'arrears';
  if (status === 'overdue') return 'overdue';
  return 'pending';
}

// Returns the highest-priority display status for a bill based on its shares.
// Priority: arrears > overdue > pending > fully-paid
export function getBillDisplayStatus(bill) {
  const shares = bill.shares ?? [];
  if (shares.length === 0) return 'pending';
  if (shares.every(s => getShareDisplayStatus(s) === 'paid')) return 'fully-paid';
  if (shares.some(s => getShareDisplayStatus(s) === 'arrears')) return 'arrears';
  if (shares.some(s => getShareDisplayStatus(s) === 'overdue')) return 'overdue';
  return 'pending';
}

export function isSharePaid(share) {
  return getShareDisplayStatus(share) === 'paid';
}
