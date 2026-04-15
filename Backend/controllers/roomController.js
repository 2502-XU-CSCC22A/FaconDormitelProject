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

module.exports = { createRoom };