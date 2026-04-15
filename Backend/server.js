const express = require('express');
const authRoutes = require('./routes/auth'); 
const roomRoutes = require('./routes/room'); 

const app = express();
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes); 

module.exports = app;