const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  register,
  login,
  getMe,
  logout,
  setPasswordWithToken,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per IP per window
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // don't count successful logins against the limit
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // 5 forgot-password requests per IP per hour
  message: { message: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// --- Public routes ---
// --- Public routes ---
router.post('/login', loginLimiter, login);
router.post('/set-password', setPasswordWithToken);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPassword);


router.post('/register', (req, res) => {
  return res.status(410).json({
    message: 'Public registration is no longer available. Tenant accounts are created by your landlord.'
  });
});

// --- Protected routes (require valid JWT) ---
router.get('/me', authMiddleware, getMe);
router.post('/logout', authMiddleware, logout);

module.exports = router;