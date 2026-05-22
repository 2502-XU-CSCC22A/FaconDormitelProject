const express = require('express');
const router = express.Router();
const { getMyBills } = require('../controllers/billController');
const { submitPayment, getMyPayments } = require('../controllers/paymentController');
const { getProfile, updateProfile, changePassword } = require('../controllers/meController');
const upload = require('../middleware/uploadMiddleware');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/',                getProfile);
router.patch('/',              updateProfile);
router.post('/change-password', changePassword);

router.get('/bills', getMyBills);

router.post('/payments', (req, res, next) => {
  upload.single('proof')(req, res, (err) => {
    if (err) return res.status(err.status || 400).json({ message: err.message });
    next();
  });
}, submitPayment);

router.get('/payments', getMyPayments);

module.exports = router;
