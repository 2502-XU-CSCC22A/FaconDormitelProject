// Centralized bill/share status utilities used by all admin and tenant pages.
// Maps the 5-state backend status to 3 display states:
//   'paid'    — share is paid or settled (terminal, green)
//   'overdue' — share is past its due date (overdue or unpaid backend status, red)
//   'pending' — share is not yet past due (yellow)

export function getShareDisplayStatus(share) {
  const { status } = share;
  if (status === 'paid' || status === 'settled') return 'paid';
  if (status === 'overdue' || status === 'unpaid') return 'overdue';
  return 'pending';
}

// Returns the highest-priority display status for a bill based on its shares.
// Priority: overdue > pending > fully-paid
export function getBillDisplayStatus(bill) {
  const shares = bill.shares ?? [];
  if (shares.length === 0) return 'pending';
  if (shares.every(s => getShareDisplayStatus(s) === 'paid')) return 'fully-paid';
  if (shares.some(s => getShareDisplayStatus(s) === 'overdue')) return 'overdue';
  return 'pending';
}

export function isSharePaid(share) {
  return getShareDisplayStatus(share) === 'paid';
}
