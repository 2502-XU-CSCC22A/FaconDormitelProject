const express = require('express');

// Import your routes
const authRoutes = require('./routes/auth'); 

const app = express();

// MUST HAVE: This allows your server to read the JSON data sent by the tests
app.use(express.json());

// Send all /api/auth requests over to your route file
app.use('/api/auth', authRoutes);

// Export it for the testing file
module.exports = app;