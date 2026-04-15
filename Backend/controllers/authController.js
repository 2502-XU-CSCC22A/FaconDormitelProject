const User = require('../models/User'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- 1. REGISTRATION ENGINE ---
const register = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      password: hashedPassword,
      role: role || 'client' 
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      user: { username: newUser.username, role: newUser.role }
    });

  } catch (error) {
    res.status(500).json({ message: "Server error during registration" });
  }
};

// --- 2. LOGIN ENGINE ---
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" }); 
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" }); 
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      'your_super_secret_development_key', 
      { expiresIn: '1h' } 
    );

    res.status(200).json({
      token: token,
      user: { username: user.username, role: user.role }
    });

  } catch (error) {
    res.status(500).json({ message: "Server error during login" });
  }
};

module.exports = { register, login };