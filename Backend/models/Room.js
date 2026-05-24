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
  // DEPRECATED: do not read/write. Use live count from User.countDocuments
  // in API responses. Kept here for backward compat with existing documents.
  currentOccupants: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['available', 'full'],
    default: 'available'
  }
});

module.exports = mongoose.model('Room', roomSchema);