const express = require('express');
const router = express.Router();
const { verifyToken, verifyOwner } = require('../middleware/authMiddleware');
const { createRoom } = require('../controllers/roomController'); 

router.post('/create', verifyToken, verifyOwner, createRoom);

module.exports = router;