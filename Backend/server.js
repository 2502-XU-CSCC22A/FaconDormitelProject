require('dotenv').config();

const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/room');
const adminRoutes = require('./routes/admin');
const meRoutes = require('./routes/me');
const cors = require('cors');

// Connect to the Docker MongoDB database
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB is successfully connected!'))
    .catch(err => console.log('Database connection error: ', err));
}
fs.mkdirSync('uploads/payment-proofs', { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', authMiddleware, express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/me', meRoutes);


if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Real server is awake and listening on port ${PORT}`);
  });
}

module.exports = app;