const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
    unique: true
  },
  capacity: {
    type: Number,
    required: true
  },
  currentOccupants: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['available', 'full'],
    default: 'available'
  },
  // ── PAYMENT BRANCH ADDITION ──────────────────────────────────
  // Array of tenant (client) User IDs assigned to this room.
  // Used by the billing system to auto-split utility costs.
  tenants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ]
  // ─────────────────────────────────────────────────────────────
});

module.exports = mongoose.model('Room', roomSchema);
