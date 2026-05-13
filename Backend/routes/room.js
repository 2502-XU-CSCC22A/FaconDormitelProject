const express = require('express');
const router = express.Router();
const { verifyToken, verifyOwner } = require('../middleware/authMiddleware');
const { createRoom, listRooms, deleteRoom } = require('../controllers/roomController'); 

router.get('/', verifyToken, verifyOwner, listRooms);
router.post('/create', verifyToken, verifyOwner, createRoom);
router.delete('/:id', verifyToken, verifyOwner, deleteRoom);

module.exports = router;