const express = require('express');
const router = express.Router();
const { createTenant, listTenants } = require('../controllers/authController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// All admin routes require authentication AND owner role.
// Apply both middlewares globally to this router.
router.use(authMiddleware);
router.use(requireRole('owner'));

// POST /api/admin/tenants  — create (invite) a new tenant
router.post('/tenants', createTenant);
router.get('/tenants', listTenants);

// Future owner-only endpoints will go here as the admin dashboard grows:
//   router.get('/tenants', listTenants);
//   router.get('/rooms', listRooms);
//   router.post('/rooms', createRoom);
//   router.post('/bills', createBill);
//   etc.

module.exports = router;