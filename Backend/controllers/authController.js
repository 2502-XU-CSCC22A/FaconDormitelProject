const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- VALIDATION HELPERS ---

const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

const validatePassword = (password) => {
  const errors = [];

  if (typeof password !== 'string') {
    errors.push('Password must be a string');
    return errors;
  }
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (password.length > 72) {
    errors.push('Password must be no more than 72 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return errors;
};

// --- 1. REGISTRATION ENGINE (TENANTS ONLY) ---
const register = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Hard-block: public registration is for tenants only.
    // Owner accounts must be provisioned via the seed script.
    if (role && role !== 'client') {
      return res.status(403).json({
        message: 'Public registration is only available for tenant accounts'
      });
    }

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        message: 'Password does not meet requirements',
        errors: passwordErrors
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      email: normalizedEmail,
      password: hashedPassword,
      role: 'client'
    });

    await newUser.save();

    return res.status(201).json({
      message: 'User registered successfully',
      user: { email: newUser.email, role: newUser.role }
    });

  } catch (error) {
    console.error('Registration error:', error);

    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Server error during registration' });
  }
};

// --- 2. LOGIN ENGINE ---
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      token: token,
      user: { email: user.email, role: user.role }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login' });
  }
};
// --- 3. GET CURRENT USER ---
// Requires authMiddleware to have run first (which attaches req.user).
const getMe = async (req, res) => {
  try {
    // req.user comes from the JWT payload (set by authMiddleware)
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      // Token was valid but the account was deleted
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// --- 4. LOGOUT ---
const logout = async (req, res) => {
  return res.status(200).json({ message: 'Logged out successfully' });
};

module.exports = { register, login, getMe, logout };