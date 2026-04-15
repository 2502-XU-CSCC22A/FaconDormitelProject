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
    default: 0 // Starts at 0 when the room is first created
  },
  status: {
    type: String,
    enum: ['available', 'full'],
    default: 'available'
  }
});

module.exports = mongoose.model('Room', roomSchema);