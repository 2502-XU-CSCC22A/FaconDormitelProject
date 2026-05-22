const express = require('express');
const router = express.Router();
const { createTenant, listTenants, deleteTenant, reassignTenantRoom } = require('../controllers/authController');
const { createBill, listBills, getBill, markShareAsPaid } = require('../controllers/billController');
const { listPayments, getPendingPayments, approvePayment, rejectPayment, voidPayment } = require('../controllers/paymentController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const { sendEmail, buildReminderEmail } = require('../services/emailService');
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
  return 'arrears';
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
        arrearsAmount: 0,
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

    // arrearsAmount = shares in arrears (past grace period)
    // overdueAmount = shares overdue (within grace period)
    // unpaidAmount  = shares pending (not yet due)
    let totalArrears = 0;
    let totalOverdue = 0;
    let totalUnpaid = 0;
    for (const entry of Object.values(tenantMap)) {
      const shares = entry._outstandingShares;

      entry.arrearsAmount = shares
        .filter(s => s.status === 'arrears' || s.status === 'unpaid')
        .reduce((sum, s) => sum + s.amount, 0);
      entry.overdueAmount = shares
        .filter(s => s.status === 'overdue')
        .reduce((sum, s) => sum + s.amount, 0);
      entry.unpaidAmount = shares
        .filter(s => s.status === 'pending')
        .reduce((sum, s) => sum + s.amount, 0);
      delete entry._outstandingShares;

      totalArrears += entry.arrearsAmount;
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
      totalArrears,
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

// Email — send reminder to a specific tenant
router.post('/email/reminder/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const ownerId = req.user.userId;

    const tenant = await User.findOne({ _id: tenantId, invitedBy: ownerId, role: 'client' })
      .populate('roomId', 'roomNumber')
      .lean();
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const bills = await Bill.find({ ownerId, 'shares.tenantId': tenantId }).lean();

    let overdueTotal = 0;
    let arrearsTotal = 0;
    let pendingTotal = 0;

    for (const bill of bills) {
      const share = bill.shares.find(s => s.tenantId?.toString() === tenantId);
      if (!share) continue;
      const status = effectiveShareStatus(share.status, bill.dueDate, bill.gracePeriodDays);
      if (status === 'paid' || status === 'settled') continue;
      if (status === 'arrears' || status === 'unpaid') arrearsTotal += Number(share.amount) || 0;
      else if (status === 'overdue') overdueTotal += Number(share.amount) || 0;
      else pendingTotal += Number(share.amount) || 0;
    }

    const totalOutstanding = overdueTotal + arrearsTotal + pendingTotal;
    if (totalOutstanding === 0) {
      return res.status(200).json({ success: true, emailSent: false, message: 'No outstanding balance' });
    }

    const emailData = buildReminderEmail({
      tenantName: tenant.name || tenant.email,
      roomNumber: tenant.roomId?.roomNumber || 'N/A',
      overdueAmount: overdueTotal,
      arrearsAmount: arrearsTotal,
      pendingAmount: pendingTotal,
      totalOutstanding
    });

    const result = await sendEmail({ to: tenant.email, ...emailData });
    return res.status(200).json({ success: result.success, emailSent: result.success });
  } catch (err) {
    console.error('[POST /api/admin/email/reminder] error:', err);
    return res.status(500).json({ message: 'Server error sending reminder' });
  }
});

// Email — blast reminder to all tenants with overdue or arrears balance
router.post('/email/blast', async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const tenants = await User.find({ invitedBy: ownerId, role: 'client' })
      .populate('roomId', 'roomNumber')
      .lean();

    const bills = await Bill.find({ ownerId }).lean();

    const tenantData = {};
    for (const t of tenants) {
      tenantData[t._id.toString()] = { ...t, overdueTotal: 0, arrearsTotal: 0, pendingTotal: 0 };
    }

    for (const bill of bills) {
      for (const share of bill.shares) {
        const key = share.tenantId?.toString();
        if (!tenantData[key]) continue;
        const status = effectiveShareStatus(share.status, bill.dueDate, bill.gracePeriodDays);
        if (status === 'paid' || status === 'settled') continue;
        if (status === 'arrears' || status === 'unpaid') tenantData[key].arrearsTotal += Number(share.amount) || 0;
        else if (status === 'overdue') tenantData[key].overdueTotal += Number(share.amount) || 0;
        else tenantData[key].pendingTotal += Number(share.amount) || 0;
      }
    }

    // Only blast to tenants who have overdue or arrears balances
    const targets = Object.values(tenantData).filter(t => t.overdueTotal > 0 || t.arrearsTotal > 0);

    let sent = 0;
    let failed = 0;
    for (const tenant of targets) {
      const totalOutstanding = tenant.overdueTotal + tenant.arrearsTotal + tenant.pendingTotal;
      const emailData = buildReminderEmail({
        tenantName: tenant.name || tenant.email,
        roomNumber: tenant.roomId?.roomNumber || 'N/A',
        overdueAmount: tenant.overdueTotal,
        arrearsAmount: tenant.arrearsTotal,
        pendingAmount: tenant.pendingTotal,
        totalOutstanding
      });
      const result = await sendEmail({ to: tenant.email, ...emailData });
      if (result.success) sent++; else failed++;
    }

    return res.status(200).json({ success: true, sent, failed, total: targets.length });
  } catch (err) {
    console.error('[POST /api/admin/email/blast] error:', err);
    return res.status(500).json({ message: 'Server error sending email blast' });
  }
});

// Payments
router.get('/payments/pending', getPendingPayments);
router.get('/payments', listPayments);
router.post('/payments/:id/approve', approvePayment);
router.post('/payments/:id/reject', rejectPayment);
router.post('/payments/:id/void', voidPayment);

module.exports = router;