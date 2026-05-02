const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address'
    ]
  },
  password: {
    type: String,
    default: null
  },
  role: {
    type: String,
    required: true,
    enum: ['owner', 'client'],
    default: 'client'
  },
  // Invite/onboarding flow
  mustSetPassword: {
    type: Boolean,
    default: false
  },
  inviteToken: {
    type: String,
    default: null,
    index: { sparse: true }   
  },
  inviteTokenExpiry: {
    type: Date,
    default: null
  },
  invitedBy: {
  
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Convenience method: clears invite-related fields when password is set
userSchema.methods.clearInvite = function() {
  this.mustSetPassword = false;
  this.inviteToken = null;
  this.inviteTokenExpiry = null;
};

module.exports = mongoose.model('User', userSchema);