const jwt = require('jsonwebtoken');

// Bouncer 1: Checks if they have a valid ID card (Token)
const verifyToken = (req, res, next) => {

  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.split(' ')[1]; // Splits "Bearer" from the actual token string

  try {
    // Check if the token is real and hasn't been tampered with
    const verified = jwt.verify(token, 'your_super_secret_development_key'); 
    req.user = verified; // Attach the user's ID and role to the request
    next(); // Let them pass!
  } catch (err) {
    res.status(400).json({ message: "Invalid token." });
  }
};

// Bouncer 2: Checks if they are specifically an "Owner"
const verifyOwner = (req, res, next) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ message: "Access denied. Owners only." });
  }
  next(); 
};

module.exports = { verifyToken, verifyOwner };