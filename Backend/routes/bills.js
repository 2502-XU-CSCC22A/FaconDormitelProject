const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const { getMyBills, getMyBillById } = require('../controllers/billController');

// All routes here require a logged-in tenant (client)
router.use(authMiddleware);
router.use(requireRole('client'));

// GET /api/bills/my           — list all my bills
router.get('/my', getMyBills);

// GET /api/bills/my/:billId   — single bill detail
router.get('/my/:billId', getMyBillById);

module.exports = router;
