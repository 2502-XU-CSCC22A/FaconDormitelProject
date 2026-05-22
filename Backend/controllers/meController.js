const User = require('../models/User');
const bcrypt = require('bcryptjs');

const validatePassword = (password) => {
  const errors = [];
  if (typeof password !== 'string') { errors.push('Password must be a string'); return errors; }
  if (password.length < 8)  errors.push('Password must be at least 8 characters long');
  if (password.length > 72) errors.push('Password must be no more than 72 characters long');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password))
    errors.push('Password must contain at least one special character');
  return errors;
};

// GET /api/me
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('name email phone role createdAt');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.status(200).json({
      user: {
        _id:       user._id,
        name:      user.name  || '',
        email:     user.email,
        phone:     user.phone || '',
        role:      user.role,
        createdAt: user.createdAt,
      }
    });
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/me  — update name and phone
const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;

    const trimmedName = (name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json({ message: 'Name is required (minimum 2 characters)' });
    }

    const trimmedPhone = (phone || '').trim();
    if (trimmedPhone && !/^[+\d][\d\s\-(). ]{4,18}$/.test(trimmedPhone)) {
      return res.status(400).json({ message: 'Please provide a valid phone number' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { name: trimmedName, phone: trimmedPhone },
      { new: true, select: 'name email phone role' }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({
      message: 'Profile updated',
      user: { name: user.name, email: user.email, phone: user.phone, role: user.role }
    });
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/me/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from your current password' });
    }

    const errors = validatePassword(newPassword);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getProfile, updateProfile, changePassword };
