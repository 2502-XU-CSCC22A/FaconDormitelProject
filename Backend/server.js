const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth'); 
const roomRoutes = require('./routes/room'); 
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to the Docker MongoDB database
mongoose.connect('mongodb://database:27017/dormisync')
  .then(() => console.log('MongoDB is successfully connected!'))
  .catch((err) => console.log('Database connection error: ', err));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes); 

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Real server is awake and listening on port ${PORT}`);
});

module.exports = app;