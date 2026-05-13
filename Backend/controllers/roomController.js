const Room = require('../models/Room');

const createRoom = async (req, res) => {
  try {
    const { roomNumber, capacity } = req.body;

    // 1. Sad Path: Check if they forgot to send the required data
    if (!roomNumber || !capacity) {
      return res.status(400).json({ message: "Room number and capacity are required" });
    }

    // 2. Happy Path: Build the new room
    const newRoom = new Room({
      roomNumber: roomNumber,
      capacity: capacity
      // currentOccupants automatically starts at 0 because of our Mongoose schema!
    });

    // 3. Save it to the database
    await newRoom.save();

    // 4. Send the exact response our test is waiting for
    res.status(201).json({
      message: "Room created successfully",
      room: newRoom
    });

  } catch (error) {
    // If Mongoose throws an E11000 error, it means the room number already exists
    if (error.code === 11000) {
        return res.status(400).json({ message: "Room number already exists" });
    }
    res.status(500).json({ message: "Server error during room creation" });
  }
};

const listRooms = async (req, res) => {
  try {
    const rooms = await Room.find().sort({ roomNumber: 1 });
    res.status(200).json({ rooms });
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({ message: 'Server error during room listing' });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    await room.deleteOne();
    return res.status(200).json({ message: 'Room removed successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ message: 'Server error during room deletion' });
  }
};

module.exports = { createRoom, listRooms, deleteRoom };