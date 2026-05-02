const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  logout,
  setPasswordWithToken
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

// --- Public routes ---
router.post('/login', login);
router.post('/set-password', setPasswordWithToken);


router.post('/register', (req, res) => {
  return res.status(410).json({
    message: 'Public registration is no longer available. Tenant accounts are created by your landlord.'
  });
});

// --- Protected routes (require valid JWT) ---
router.get('/me', authMiddleware, getMe);
router.post('/logout', authMiddleware, logout);

module.exports = router;