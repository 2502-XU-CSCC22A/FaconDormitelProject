const express = require('express');
const router = express.Router();
const { createTenant, listTenants } = require('../controllers/authController');
const { createBill, listBills, getBill, markShareAsPaid } = require('../controllers/billController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// All admin routes require authentication AND owner role.
router.use(authMiddleware);
router.use(requireRole('owner'));

// Tenants
router.post('/tenants', createTenant);
router.get('/tenants', listTenants);

// Bills
router.post('/bills', createBill);
router.get('/bills', listBills);
router.get('/bills/:id', getBill);
router.post('/bills/:billId/shares/:shareId/pay', markShareAsPaid);

module.exports = router;