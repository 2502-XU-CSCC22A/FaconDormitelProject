const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/User');

// 1. Import the real app from your new server.js file!
const app = require('../server'); 

// --- DATABASE SETUP FOR TESTING ---
beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/dormisync_test');
});

afterAll(async () => {
  await User.deleteMany({});
  await mongoose.connection.close();
});
// ----------------------------------

// --- YOUR TEST ---
describe("User Management Module - Registration", () => {
  it("should successfully register a new client account", async () => {
    const newUserData = {
      username: "student123",
      password: "MySecurePassword!",
      role: "client"
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(newUserData);

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("User registered successfully");
    expect(response.body.user).not.toHaveProperty('password');
  });
});