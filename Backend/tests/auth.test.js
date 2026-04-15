const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/User');

const app = require('../server'); 

beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/dormisync_test');
});

afterAll(async () => {
  await User.deleteMany({});
  await mongoose.connection.close();
});


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

// NEW: Login & Security Tests
describe("User Management Module - Authentication (Login)", () => {
  
  it("should successfully log in a user and return a JWT token", async () => {
    // try to log in using the exact user we created in the test above
    const loginData = {
      username: "student123",
      password: "MySecurePassword!"
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(loginData);

    expect(response.status).toBe(200); 
    expect(response.body).toHaveProperty('token'); // Must receive a security token
    expect(response.body.user).toHaveProperty('role', 'client'); // Must verify their RBAC role
  });

  it("should reject login with an incorrect password", async () => {
    const wrongLoginData = {
      username: "student123",
      password: "wrongpassword123"
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(wrongLoginData);

    expect(response.status).toBe(401); // 401 means "Unauthorized"
    expect(response.body.message).toBe("Invalid credentials");
  });
});