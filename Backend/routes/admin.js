const express = require('express');
const router = express.Router();
const { createTenant, listTenants, deleteTenant, reassignTenantRoom } = require('../controllers/authController');
const { createBill, listBills, getBill, markShareAsPaid } = require('../controllers/billController');
const { listPayments, getPendingPayments, approvePayment, rejectPayment, voidPayment } = require('../controllers/paymentController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const Room = require('../models/Room');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const User = require('../models/User');

// All admin routes require authentication AND owner role.
router.use(authMiddleware);
router.use(requireRole('owner'));

// Tenants
router.post('/tenants', createTenant);
router.get('/tenants', listTenants);
router.delete('/tenants/:id', deleteTenant);
router.patch('/tenants/:id/room', reassignTenantRoom);
// TODO(module-b): replace this stub when teammate's Module B (Rooms) lands.
// Returns minimal room list for the bill creation dropdown.
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.find({})
      .select('_id roomNumber name capacity currentOccupants status')
      .lean();
    return res.status(200).json({ rooms });
  } catch (err) {
    console.error('[GET /api/admin/rooms] error:', err);
    return res.status(500).json({ message: 'Server error fetching rooms' });
  }
});
// Bills
router.post('/bills', createBill);
router.get('/bills', listBills);
router.get('/bills/:id', getBill);
router.post('/bills/:billId/shares/:shareId/pay', markShareAsPaid);

// Summary dashboard
// Compute what a share's status SHOULD be right now, regardless of what's
// stored in the DB.  Terminal states ('paid', 'settled') are always trusted;
// non-terminal states are re-derived from dueDate so the summary is correct
// even if the per-bill tick hasn't run yet.
function effectiveShareStatus(shareStatus, billDueDate, gracePeriodDays) {
  if (shareStatus === 'paid' || shareStatus === 'settled') return shareStatus;
  const now = Date.now();
  const dueMs = new Date(billDueDate).getTime();
  const grace = gracePeriodDays ?? 5;
  const overdueEndMs = dueMs + grace * 24 * 60 * 60 * 1000;
  if (now < dueMs) return 'pending';
  if (now < overdueEndMs) return 'overdue';
  return 'unpaid';
}

router.get('/summary', async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const tenants = await User.find({ invitedBy: ownerId, role: 'client' })
      .select('_id name email status roomId')
      .populate('roomId', 'roomNumber')
      .lean();

    const bills = await Bill.find({ ownerId }).lean();

    const lastApprovedPayment = await Payment.findOne({ ownerId, status: 'approved' })
      .sort({ reviewedAt: -1 })
      .lean();

    const tenantMap = {};
    for (const t of tenants) {
      tenantMap[t._id.toString()] = {
        _id: t._id,
        name: t.name,
        email: t.email,
        status: t.status,
        room: t.roomId ? { roomNumber: t.roomId.roomNumber } : null,
        totalBilled: 0,
        overdueAmount: 0,
        unpaidAmount: 0,
        _outstandingShares: []
      };
    }

    for (const bill of bills) {
      for (const share of bill.shares) {
        const key = share.tenantId?.toString();
        if (!tenantMap[key]) continue;
        tenantMap[key].totalBilled += (Number(share.amount) || 0);
        // Re-derive status from dueDate so the summary is always accurate,
        // even if the per-bill tick hasn't fired yet for this bill.
        const status = effectiveShareStatus(
          share.status, bill.dueDate, bill.gracePeriodDays
        );
        if (status !== 'paid' && status !== 'settled') {
          tenantMap[key]._outstandingShares.push({
            amount: Number(share.amount) || 0,
            status
          });
        }
      }
    }

    // overdueAmount = shares that are past due (status: overdue or unpaid)
    // unpaidAmount  = shares not yet past due (status: pending)
    let totalOverdue = 0;
    let totalUnpaid = 0;
    for (const entry of Object.values(tenantMap)) {
      const shares = entry._outstandingShares;

      entry.overdueAmount = shares
        .filter(s => s.status === 'overdue' || s.status === 'unpaid')
        .reduce((sum, s) => sum + s.amount, 0);
      entry.unpaidAmount = shares
        .filter(s => s.status === 'pending')
        .reduce((sum, s) => sum + s.amount, 0);
      delete entry._outstandingShares;

      totalOverdue += entry.overdueAmount;
      totalUnpaid += entry.unpaidAmount;
    }

    let lastPaymentInfo = null;
    if (lastApprovedPayment) {
      const payer = await User.findById(lastApprovedPayment.tenantId).select('name email').lean();
      lastPaymentInfo = {
        tenantName: payer?.name || payer?.email || 'Unknown',
        amount: lastApprovedPayment.amount,
        date: lastApprovedPayment.reviewedAt || lastApprovedPayment.paymentDate
      };
    }

    return res.status(200).json({
      totalTenants: tenants.length,
      activeTenants: tenants.filter(t => t.status === 'active').length,
      totalOverdue,
      totalUnpaid,
      lastPayment: lastPaymentInfo,
      tenants: Object.values(tenantMap)
    });
  } catch (err) {
    console.error('[GET /api/admin/summary] error:', err);
    return res.status(500).json({ message: 'Server error fetching summary' });
  }
});

// Payments
router.get('/payments/pending', getPendingPayments);
router.get('/payments', listPayments);
router.post('/payments/:id/approve', approvePayment);
router.post('/payments/:id/reject', rejectPayment);
router.post('/payments/:id/void', voidPayment);

module.exports = router;