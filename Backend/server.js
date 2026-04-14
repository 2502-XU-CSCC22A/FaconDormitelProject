const express = require('express');
const bcrypt = require('bcrypt');
const User = require('./models/User'); 

const app = express();
app.use(express.json());

app.post('/api/auth/register', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10); 
    const newUser = new User({ username, password: hashedPassword, role });
    await newUser.save();
    
    res.status(201).json({
      message: "User registered successfully",
      user: { username: newUser.username, role: newUser.role }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error during registration" });
  }
});

module.exports = app;