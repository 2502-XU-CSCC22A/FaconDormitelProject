const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true //  block duplicate usernames later
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    required: true,
    enum: ['owner', 'client'] // Ensures no one can type a fake role
  }
});

module.exports = mongoose.model('User', userSchema);