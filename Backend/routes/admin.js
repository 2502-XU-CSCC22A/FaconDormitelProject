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
router.get('/summary', async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const now = new Date();

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
        // pending shares collected for post-processing
        _pendingShares: []
      };
    }

    for (const bill of bills) {
      const isPastDue = bill.dueDate < now;
      for (const share of bill.shares) {
        const key = share.tenantId?.toString();
        if (!tenantMap[key]) continue;
        tenantMap[key].totalBilled += (Number(share.amount) || 0);
        if (share.status === 'pending') {
          tenantMap[key]._pendingShares.push({
            amount: Number(share.amount) || 0,
            dueDate: bill.dueDate,
            isPastDue
          });
        }
      }
    }

    // Overdue = only the single most-recent past-due share per tenant.
    // All other pending shares (older overdue + not-yet-due) go into unpaid.
    // When a new month's bill becomes overdue, the previous one rolls to unpaid.
    // Uses index-based exclusion to avoid object-reference comparison issues.
    let totalOverdue = 0;
    let totalUnpaid = 0;
    for (const entry of Object.values(tenantMap)) {
      const shares = entry._pendingShares;

      // Find the index of the most-recent past-due share
      let latestOverdueIdx = -1;
      let latestDueDate = null;
      for (let i = 0; i < shares.length; i++) {
        if (shares[i].isPastDue) {
          if (latestDueDate === null || shares[i].dueDate > latestDueDate) {
            latestDueDate = shares[i].dueDate;
            latestOverdueIdx = i;
          }
        }
      }

      entry.overdueAmount = latestOverdueIdx >= 0 ? shares[latestOverdueIdx].amount : 0;
      entry.unpaidAmount = shares.reduce((sum, s, i) => {
        return i === latestOverdueIdx ? sum : sum + s.amount;
      }, 0);
      delete entry._pendingShares;

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