const jwt = require('jsonwebtoken');

/**
 * Verifies that the request has a valid JWT in the Authorization header.
 * On success, attaches the decoded token payload (userId, role) to req.user.
 *
 * Usage:
 *   router.get('/protected', authMiddleware, handler);
 */
const authMiddleware = (req, res, next) => {
  // Sanity check: the secret must be loaded
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not defined in environment variables');
    return res.status(500).json({ message: 'Server configuration error' });
  }

  // Read the Authorization header
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  // Expect "Bearer <token>" format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ message: 'Access denied. Malformed token.' });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Access denied. Token expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Access denied. Invalid token.' });
    }
    console.error('Auth middleware error:', err);
    return res.status(401).json({ message: 'Access denied.' });
  }
};

/**
 * Returns a middleware that allows the request only if req.user.role
 * matches the required role. 
 *
 * Usage:
 *   router.get('/owner-only', authMiddleware, requireRole('owner'), handler);
 */
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
     
      return res.status(401).json({ message: 'Access denied. Not authenticated.' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ message: `Access denied. ${role}s only.` });
    }
    next();
  };
};

const verifyToken = authMiddleware;
const verifyOwner = (req, res, next) => requireRole('owner')(req, res, next);

module.exports = {
  authMiddleware,
  requireRole,
  verifyToken,    // alias for authMiddleware (backwards compat)
  verifyOwner     // wraps requireRole('owner') (backwards compat)
};