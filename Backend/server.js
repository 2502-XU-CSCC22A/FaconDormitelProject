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
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB is successfully connected!'))
    .catch(err => console.log('Database connection error: ', err));
}
fs.mkdirSync('uploads/payment-proofs', { recursive: true });

const app = express();

// Security headers
app.use(helmet());

// CORS — only allow the configured frontend origin
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,https://rfacondormitel.vercel.app').split(',').map(s => s.trim());
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    console.warn('[CORS] Rejected origin:', JSON.stringify(origin), 'allowed:', JSON.stringify(allowedOrigins));
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
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