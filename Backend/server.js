require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth'); 
const roomRoutes = require('./routes/room'); 
const cors = require('cors');

// Connect to the Docker MongoDB database
// Replace the hardcoded string with process.env.MONGO_URI
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB is successfully connected!'))
  .catch(err => console.log('Database connection error: ', err));
const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes); 


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Real server is awake and listening on port ${PORT}`);
});

module.exports = app;