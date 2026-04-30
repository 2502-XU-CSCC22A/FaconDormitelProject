const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/User');

const app = require('../server');

// Set a JWT secret for the test environment so login/middleware can sign and verify tokens
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_jest_runs_only';

// Shared test fixtures
const VALID_EMAIL = 'student123@uni.edu';
const VALID_PASSWORD = 'MySecure1!';

beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/dormisync_test');
});

// Clean the users collection between tests so they don't interfere with each other
beforeEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await User.deleteMany({});
  await mongoose.connection.close();
});

// =========================================================================
// REGISTRATION
// =========================================================================
describe('User Management Module - Registration', () => {

  it('should successfully register a new client account', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        role: 'client'
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('User registered successfully');
    expect(response.body.user).toHaveProperty('email', VALID_EMAIL);
    expect(response.body.user).toHaveProperty('role', 'client');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('should default role to "client" when no role is provided', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: VALID_EMAIL, password: VALID_PASSWORD });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('client');
  });

  it('should normalize email to lowercase on registration', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'MixedCase@UNI.edu', password: VALID_PASSWORD });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('mixedcase@uni.edu');
  });

  it('should reject registration when email is missing', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ password: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/required/i);
  });

  it('should reject registration when password is missing', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: VALID_EMAIL });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/required/i);
  });

  it('should reject an invalid email format', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/valid email/i);
  });

  it('should reject a duplicate email with status 409', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: VALID_EMAIL, password: VALID_PASSWORD });

    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: VALID_EMAIL, password: VALID_PASSWORD });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists/i);
  });

  it('should treat differently-cased emails as duplicates', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'foo@uni.edu', password: VALID_PASSWORD });

    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'FOO@UNI.EDU', password: VALID_PASSWORD });

    expect(response.status).toBe(409);
  });
});

// =========================================================================
// PASSWORD VALIDATION
// =========================================================================
describe('User Management Module - Password Validation', () => {

  const weakPasswords = [
    { label: 'too short',            password: 'Aa1!' },
    { label: 'no uppercase letter',  password: 'mysecure1!' },
    { label: 'no lowercase letter',  password: 'MYSECURE1!' },
    { label: 'no number',            password: 'MySecurePass!' },
    { label: 'no special character', password: 'MySecure123' }
  ];

  weakPasswords.forEach(({ label, password }) => {
    it(`should reject password with ${label}`, async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: VALID_EMAIL, password });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });

  it('should return all failed rules at once when password fails multiple', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: VALID_EMAIL, password: 'abc' });

    expect(response.status).toBe(400);
    expect(response.body.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// =========================================================================
// PUBLIC REGISTRATION ROLE ENFORCEMENT
// =========================================================================
describe('User Management Module - Role Enforcement', () => {

  it('should reject registration with role=owner (403)', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'sneaky@uni.edu',
        password: VALID_PASSWORD,
        role: 'owner'
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/tenant/i);
  });

  it('should reject registration with any non-client role (403)', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'admin@uni.edu',
        password: VALID_PASSWORD,
        role: 'admin'
      });

    expect(response.status).toBe(403);
  });

  it('should accept registration when role is explicitly client', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'tenant@uni.edu',
        password: VALID_PASSWORD,
        role: 'client'
      });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('client');
  });

  it('should default to client role when no role is sent', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'default@uni.edu',
        password: VALID_PASSWORD
      });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('client');
  });
});

// =========================================================================
// LOGIN
// =========================================================================
describe('User Management Module - Authentication (Login)', () => {

  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: VALID_EMAIL, password: VALID_PASSWORD, role: 'client' });
  });

  it('should successfully log in a user and return a JWT token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_EMAIL, password: VALID_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user).toHaveProperty('email', VALID_EMAIL);
    expect(response.body.user).toHaveProperty('role', 'client');
  });

  it('should accept login with differently-cased email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_EMAIL.toUpperCase(), password: VALID_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });

  it('should reject login with an incorrect password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_EMAIL, password: 'WrongPass1!' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid credentials');
  });

  it('should reject login for a non-existent user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@uni.edu', password: VALID_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid credentials');
  });

  it('should reject login when fields are missing', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_EMAIL });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/required/i);
  });
});

// =========================================================================
// PROTECTED ROUTES (/me and /logout)
// =========================================================================
describe('User Management Module - Protected Routes', () => {

  let validToken;

  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: VALID_EMAIL, password: VALID_PASSWORD });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_EMAIL, password: VALID_PASSWORD });

    validToken = loginRes.body.token;
  });

  // --- GET /api/auth/me ---

  it('should reject GET /me when no token is provided', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/no token/i);
  });

  it('should reject GET /me when Authorization header is malformed', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'NotBearer something');

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/malformed/i);
  });

  it('should reject GET /me when token is invalid', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer this_is_not_a_real_jwt');

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/invalid/i);
  });

  it('should return current user data on GET /me with a valid token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toHaveProperty('email', VALID_EMAIL);
    expect(response.body.user).toHaveProperty('role', 'client');
    expect(response.body.user).toHaveProperty('_id');
  });

  it('should NOT include the password field in GET /me response', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user).not.toHaveProperty('password');
  });

  // --- POST /api/auth/logout ---

  it('should accept POST /logout with a valid token', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/logged out/i);
  });

  it('should reject POST /logout without a token', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(401);
  });
});