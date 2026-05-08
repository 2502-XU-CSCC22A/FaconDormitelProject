const express = require('express');
const router = express.Router();
const { getMyBills } = require('../controllers/billController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/bills', getMyBills);

module.exports = router;
