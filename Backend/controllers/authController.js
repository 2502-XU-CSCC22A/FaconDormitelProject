const { sendEmail, buildInviteEmail, buildResetEmail } = require('../services/emailService');
const dns = require('dns').promises;
const User = require('../models/User');
const Bill = require('../models/Bill');
const Room = require('../models/Room');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');

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
const hasValidMxRecord = async (email) => {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;

    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch (err) {
    // ENOTFOUND, ENODATA, etc. = no MX records or no domain
    return false;
  }
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


if (user.mustSetPassword || !user.password) {
  return res.status(403).json({
    message: 'You need to set up your password first. Please use the invite link sent by your landlord.'
  });
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
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('roomId', '_id roomNumber name capacity');

    if (!user) {
      // Token was valid but the account was deleted
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        roomId: user.roomId,        // populated room object or null
        status: user.status
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

// --- 5. CREATE TENANT (OWNER-ONLY) ---
// Owners use this to invite new tenants. We create the User record
// but DO NOT set a password — the tenant sets one via an invite link.
const createTenant = async (req, res) => {
  try {
    const { name, email, roomId } = req.body;

    // Field presence
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    // Email domain validation — does the domain actually accept mail?
    const mxValid = await hasValidMxRecord(email);
    if (!mxValid) {
      return res.status(400).json({
        message: 'This email domain does not appear to accept mail. Please check for typos.'
      });
    }
   // Name validation (forward-only — existing records aren't affected)
    const trimmedName = (name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json({ message: 'Name is required (minimum 2 characters)' });
    }
    // Capacity check — must run before creating/updating any User document
    if (roomId) {
      const room = await Room.findById(roomId);
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }
      const occupantCount = await User.countDocuments({ roomId, role: 'client' });
      if (occupantCount >= room.capacity) {
        return res.status(409).json({
          message: `Room ${room.roomNumber} is at full capacity (${room.capacity}/${room.capacity})`
        });
      }
    }

    const normalizedEmail = email.trim().toLowerCase();
    // Look up any existing user with this email
    const existing = await User.findOne({ email: normalizedEmail });

    // Generate a fresh invite token (32 bytes = 64 hex chars; cryptographically random)
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const inviteTokenExpiry = new Date(Date.now() + SEVEN_DAYS);

    let user;

    if (existing) {
      // Case A: existing tenant who hasn't set a password yet → re-issue invite
      if (existing.role === 'client' && existing.mustSetPassword) {
        existing.name = trimmedName;
        existing.inviteToken = inviteToken;
        existing.inviteTokenExpiry = inviteTokenExpiry;
        existing.invitedBy = req.user.userId;
        if (roomId) existing.roomId = roomId;
        await existing.save();
        user = existing;
      } else {
        // Case B: account already fully active (or it's an owner) → conflict
        return res.status(409).json({
          message: 'An account with this email already exists'
        });
      }
    } else {
      // Case C: brand new tenant → create
      user = new User({
        name: trimmedName,
        email: normalizedEmail,
        password: null,
        role: 'client',
        mustSetPassword: true,
        inviteToken,
        inviteTokenExpiry,
        invitedBy: req.user.userId,
        ...(roomId ? { roomId } : {})
      });
      await user.save();
    }

    // Build the invite link the owner will share with the tenant.
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/set-password?token=${inviteToken}`;

    let emailSent = false;
    let emailError = null;
    try {
      const owner = await User.findById(req.user.userId).select('name email');
      const { subject, html, text } = buildInviteEmail({
        tenantName: trimmedName,
        inviteLink,
        ownerName: owner?.name || 'Your landlord'
      });
      const result = await sendEmail({ to: normalizedEmail, subject, html, text });
      emailSent = result.success;
      if (!result.success) emailError = result.error;
    } catch (err) {
      console.error('[createTenant] Email error:', err.message);
      emailError = err.message;
    }

    return res.status(201).json({
      message: 'Tenant invited successfully',
      tenant: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustSetPassword: user.mustSetPassword
      },
      inviteLink,
      inviteExpiresAt: inviteTokenExpiry,
      emailSent,
      emailError   
    });

  } catch (error) {
    console.error('Create tenant error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error during tenant creation' });
  }
};

// --- 6. SET PASSWORD WITH INVITE TOKEN (PUBLIC) ---
// Tenants click the invite link, land on /set-password?token=xyz,
// then submit their new password. This validates the token, hashes
// the password, and clears the invite fields.
const setPasswordWithToken = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    // Password strength
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        message: 'Password does not meet requirements',
        errors: passwordErrors
      });
    }

    // Find user by token
    const user = await User.findOne({ inviteToken: token });

    // Generic error message: never reveal whether token exists or not
    // (prevents attackers from probing for valid tokens)
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired invite link' });
    }

    // Check token expiry
    if (!user.inviteTokenExpiry || user.inviteTokenExpiry.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired invite link' });
    }

    // Defense-in-depth: only allow this flow for users who actually need
    // to set a password. Already-onboarded users shouldn't be able to use
    // a leftover token to overwrite their password.
    if (!user.mustSetPassword) {
      return res.status(400).json({ message: 'Invalid or expired invite link' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.clearInvite();   // sets mustSetPassword=false, inviteToken=null, inviteTokenExpiry=null
    await user.save();

    return res.status(200).json({
      message: 'Password set successfully. You can now log in.',
      user: {
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Set password error:', error);
    return res.status(500).json({ message: 'Server error while setting password' });
  }
};

// --- 7. LIST TENANTS (OWNER-ONLY) ---
// Returns all client (tenant) accounts for the admin dashboard table.
// Includes invite status so the UI can show 'Pending' vs 'Active'.
const listTenants = async (req, res) => {
  try {
    const tenants = await User.find(
      { role: 'client' },
      { name: 1, email: 1, mustSetPassword: 1, inviteTokenExpiry: 1, createdAt: 1, roomId: 1 }
    )
      .populate('roomId', 'roomNumber name')
      .sort({ createdAt: -1 });

    const formatted = tenants.map((t) => ({
      _id: t._id,
      name: t.name || '',
      email: t.email,
      status: t.mustSetPassword ? 'pending' : 'active',
      inviteExpiresAt: t.mustSetPassword ? t.inviteTokenExpiry : null,
      createdAt: t.createdAt,
      room: t.roomId ? { _id: t.roomId._id, roomNumber: t.roomId.roomNumber, name: t.roomId.name } : null
    }));

    return res.status(200).json({ tenants: formatted });
  } catch (error) {
    console.error('List tenants error:', error);
    return res.status(500).json({ message: 'Server error while fetching tenants' });
  }
};

// --- 8. DELETE TENANT (OWNER-ONLY) ---
// Hard-deletes a tenant account after verifying no pending bill shares exist.
// Bills that already reference the tenant are preserved (frozen snapshot design).
const deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const tenant = await User.findById(id);
    if (!tenant || tenant.role !== 'client') {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Check for pending bill shares before deleting
    const billsWithUnpaid = await Bill.find({
      shares: { $elemMatch: { tenantId: new mongoose.Types.ObjectId(id), status: 'pending' } }
    });

    let unpaidCount = 0;
    let unpaidTotal = 0;
    for (const bill of billsWithUnpaid) {
      for (const share of bill.shares) {
        if (share.tenantId && share.tenantId.toString() === id && share.status === 'pending') {
          unpaidCount++;
          unpaidTotal += share.amount;
        }
      }
    }

    if (unpaidCount > 0) {
      return res.status(409).json({
        message: 'Cannot delete tenant with unpaid bills',
        unpaidCount,
        unpaidTotal
      });
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({
      message: 'Tenant removed',
      tenant: { _id: tenant._id, email: tenant.email, name: tenant.name || '' }
    });

  } catch (error) {
    console.error('Delete tenant error:', error);
    return res.status(500).json({ message: 'Server error during tenant deletion' });
  }
};

// --- 9. FORGOT PASSWORD (PUBLIC) ---
// Always returns the same 200 response regardless of whether the email exists,
// to prevent user enumeration attacks.
const forgotPassword = async (req, res) => {
  const GENERIC_MSG = 'If an account exists with that email, we have sent reset instructions.';
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const ONE_HOUR = 60 * 60 * 1000;
      user.resetToken = resetToken;
      user.resetTokenExpiry = new Date(Date.now() + ONE_HOUR);
      await user.save();

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

      try {
        const { subject, html, text } = buildResetEmail({ userName: user.name, resetLink });
        await sendEmail({ to: normalizedEmail, subject, html, text });
      } catch (emailErr) {
        console.error('[forgotPassword] Email error:', emailErr.message);
      }
    }

    return res.status(200).json({ message: GENERIC_MSG });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Server error during password reset request' });
  }
};

// --- 10. RESET PASSWORD WITH TOKEN (PUBLIC) ---
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        message: 'Password does not meet requirements',
        errors: passwordErrors
      });
    }

    const user = await User.findOne({ resetToken: token });

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error during password reset' });
  }
};

// --- 11. REASSIGN TENANT ROOM (OWNER-ONLY) ---
// PATCH /api/admin/tenants/:id/room   body: { roomId: ObjectId | null }
// Moves a tenant to a different room, or unassigns them (roomId: null).
const reassignTenantRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { roomId } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Owner-scoped: only tenants this owner invited
    const tenant = await User.findOne({ _id: id, role: 'client', invitedBy: req.user.userId });
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const oldRoomId = tenant.roomId ? tenant.roomId.toString() : null;

    // Unassign path
    if (!roomId) {
      tenant.roomId = null;
      await tenant.save();
      return res.status(200).json({ message: 'Tenant unassigned from room', tenant: { _id: tenant._id, roomId: null } });
    }

    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // No-op: already in this room
    if (oldRoomId === roomId.toString()) {
      return res.status(200).json({ message: 'No change', tenant: { _id: tenant._id, roomId: tenant.roomId } });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Capacity check — exclude this tenant in case they're somehow already counted
    const occupantCount = await User.countDocuments({
      roomId: room._id,
      role: 'client',
      _id: { $ne: tenant._id }
    });
    if (occupantCount >= room.capacity) {
      return res.status(409).json({
        message: `Room ${room.roomNumber} is at full capacity (${room.capacity}/${room.capacity})`
      });
    }

    // Swap rooms
    tenant.roomId = room._id;
    await tenant.save();

    return res.status(200).json({
      message: 'Tenant room updated',
      tenant: { _id: tenant._id, roomId: tenant.roomId }
    });

  } catch (error) {
    console.error('Reassign tenant room error:', error);
    return res.status(500).json({ message: 'Server error during room reassignment' });
  }
};

module.exports = { register, login, getMe, logout, createTenant, setPasswordWithToken, listTenants, deleteTenant, forgotPassword, resetPassword, reassignTenantRoom };

