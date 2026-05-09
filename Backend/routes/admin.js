const express = require('express');
const router = express.Router();
const { createTenant, listTenants } = require('../controllers/authController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const {
  createBill,
  listBills,
  getBillById,
  updatePaymentStatus,
  assignTenantToRoom,
  removeTenantFromRoom
} = require('../controllers/billController');

// All admin routes require authentication AND owner role.
router.use(authMiddleware);
router.use(requireRole('owner'));

// ── Tenant management ────────────────────────────────────────────
router.post('/tenants', createTenant);
router.get('/tenants', listTenants);

// ── Room ↔ Tenant assignment ─────────────────────────────────────
// POST   /api/admin/rooms/:roomId/tenants          — assign a tenant to a room
// DELETE /api/admin/rooms/:roomId/tenants/:tenantId — remove a tenant from a room
router.post('/rooms/:roomId/tenants', assignTenantToRoom);
router.delete('/rooms/:roomId/tenants/:tenantId', removeTenantFromRoom);

// ── Bill management ──────────────────────────────────────────────
// POST   /api/admin/bills                                 — create a bill for a room
// GET    /api/admin/bills                                 — list all bills
// GET    /api/admin/bills/:billId                         — single bill detail
// PATCH  /api/admin/bills/:billId/tenants/:tenantId       — update payment status
router.post('/bills', createBill);
router.get('/bills', listBills);
router.get('/bills/:billId', getBillById);
router.patch('/bills/:billId/tenants/:tenantId', updatePaymentStatus);

module.exports = router;
