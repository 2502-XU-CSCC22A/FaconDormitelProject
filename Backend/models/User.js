const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,        // store all emails lowercase to avoid case-duplicate accounts
    trim: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required']

  },
  role: {
    type: String,
    required: true,
    enum: ['owner', 'client'],
    default: 'client'
  }
}, {
  timestamps: true   // adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('User', userSchema);