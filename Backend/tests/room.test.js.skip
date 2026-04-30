// This tells Jest to delete all rooms from the database before starting
beforeEach(async () => {
  await Room.deleteMany({});
});

const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/User');
const Room = require('../models/Room'); 
const app = require('../server');

let ownerToken = "";
let clientToken = "";

beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/dormisync_test');
  await User.deleteMany({});

  const ownerRes = await request(app).post('/api/auth/register').send({
    username: "landlord1", password: "password123", role: "owner"
  });
  const clientRes = await request(app).post('/api/auth/register').send({
    username: "student1", password: "password123", role: "client"
  });

  const loginOwner = await request(app).post('/api/auth/login').send({ username: "landlord1", password: "password123" });
  ownerToken = loginOwner.body.token;

  const loginClient = await request(app).post('/api/auth/login').send({ username: "student1", password: "password123" });
  clientToken = loginClient.body.token;
});

afterAll(async () => {
  await mongoose.connection.close();
});

// --- THE MIDDLEWARE TESTS ---
describe("RBAC Security Middleware (The Bouncer)", () => {
  
  it("should deny access if NO token is provided", async () => {
    const response = await request(app).post('/api/rooms/create');
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Access denied. No token provided.");
  });

  it("should deny access if a 'Client' tries to access an 'Owner' route", async () => {
    const response = await request(app)
      .post('/api/rooms/create')
      .set('Authorization', `Bearer ${clientToken}`); 

    expect(response.status).toBe(403); 
    expect(response.body.message).toBe("Access denied. Owners only.");
  });
});

// --- THE ROOM MANAGEMENT TESTS ---
describe("Room Management Module", () => {
  
  it("should allow an Owner to successfully create a new room", async () => {
    const newRoomData = {
      roomNumber: "103C",
      capacity: 4
    };

    const response = await request(app)
      .post('/api/rooms/create')
      .set('Authorization', `Bearer ${ownerToken}`) 
      .send(newRoomData);

    expect(response.body.message).toBe("Room created successfully");
    expect(response.body.room).toHaveProperty('roomNumber', '103C');
    expect(response.body.room).toHaveProperty('capacity', 4);
    expect(response.body.room).toHaveProperty('currentOccupants', 0);
  });

  it("should reject room creation if data is missing", async () => {
    const badRoomData = {
      capacity: 4 
    };

    const response = await request(app)
      .post('/api/rooms/create')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(badRoomData);

    expect(response.status).toBe(400); 
    expect(response.body.message).toBe("Room number and capacity are required");
  });
});