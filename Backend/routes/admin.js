const express = require('express');
const router = express.Router();
const { createTenant, listTenants, deleteTenant, reassignTenantRoom } = require('../controllers/authController');
const { createBill, listBills, getBill, markShareAsPaid } = require('../controllers/billController');
const { listPayments, getPendingPayments, approvePayment, rejectPayment, voidPayment } = require('../controllers/paymentController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const Room = require('../models/Room');

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

// Payments
router.get('/payments/pending', getPendingPayments);
router.get('/payments', listPayments);
router.post('/payments/:id/approve', approvePayment);
router.post('/payments/:id/reject', rejectPayment);
router.post('/payments/:id/void', voidPayment);

module.exports = router;