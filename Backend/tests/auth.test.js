// Backend/tests/auth.test.js
//
// Integration tests for the auth module (post owner-invites-tenant refactor).
// Coverage:
//   - Login (positive, negative, mustSetPassword block)
//   - Protected routes (auth middleware behavior)
//   - Admin: create tenant (owner-only, validation, conflict cases)
//   - Public: set password via invite token (validation, expiry, replay)
//   - Deprecated /register endpoint (should return 410 Gone)
//
// Run from Backend/ with: npm test

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const app = require('../server');

// JWT secret for the test environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_jest_runs_only';

// Shared fixtures
const OWNER_EMAIL = 'owner@dormisync.local';
const OWNER_PASSWORD = 'OwnerStrong1!';
const TENANT_EMAIL = 'tenant1@uni.edu';
const TENANT_NAME = 'Test Tenant';
const VALID_PASSWORD = 'MySecure1!';

// Helper: seed an owner directly in the database (bypasses the seed script)
async function seedOwner(email = OWNER_EMAIL, password = OWNER_PASSWORD) {
  const hashed = await bcrypt.hash(password, 10);
  return await User.create({
    email,
    password: hashed,
    role: 'owner',
    name: 'Test Owner',
    mustSetPassword: false
  });
}

// Helper: log in and return a JWT token
async function loginAs(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.token;
}

// Helper: extract token from an invite link like ".../set-password?token=xyz"
function extractToken(inviteLink) {
  return inviteLink.split('token=')[1];
}

// Test setup
beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/dormisync_test');
  // Wipe stale indexes from previous schema versions, then sync current schema's indexes.
  // Prevents tests from breaking when the User schema's indexed fields change.
  await User.collection.dropIndexes().catch(() => { /* ignore if no indexes exist yet */ });
  await User.syncIndexes();
});

beforeEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await User.deleteMany({});
  await mongoose.connection.close();
});


// =========================================================================
// LOGIN
// =========================================================================
describe('Auth Module - Login', () => {
  it('should log in successfully with valid credentials and return JWT', async () => {
    await seedOwner();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(typeof response.body.token).toBe('string');
    expect(response.body.user).toHaveProperty('email', OWNER_EMAIL);
    expect(response.body.user).toHaveProperty('role', 'owner');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('should return 401 when password is wrong', async () => {
    await seedOwner();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: OWNER_EMAIL, password: 'WrongPassword1!' });

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/invalid credentials/i);
  });

  it('should return 401 when email does not exist', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@uni.edu', password: VALID_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/invalid credentials/i);
  });

  it('should return 400 when email or password is missing', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: OWNER_EMAIL });

    expect(response.status).toBe(400);
  });

  it('should return 403 when user has mustSetPassword=true', async () => {
    // Create an invited tenant who hasn't set a password yet
    await User.create({
      email: TENANT_EMAIL,
      password: null,
      role: 'client',
      mustSetPassword: true,
      inviteToken: 'sometoken',
      inviteTokenExpiry: new Date(Date.now() + 1000 * 60 * 60)
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: TENANT_EMAIL, password: 'anything' });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/set up your password/i);
  });

  it('should be case-insensitive for email', async () => {
    await seedOwner();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: OWNER_EMAIL.toUpperCase(), password: OWNER_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});


// =========================================================================
// DEPRECATED REGISTRATION ENDPOINT
// =========================================================================
describe('Auth Module - Deprecated /register endpoint', () => {
  it('should return 410 Gone for any POST /register attempt', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: TENANT_EMAIL, password: VALID_PASSWORD });

    expect(response.status).toBe(410);
    expect(response.body.message).toMatch(/no longer available/i);
  });
});


// =========================================================================
// PROTECTED ROUTES (auth middleware)
// =========================================================================
describe('Auth Module - Protected Routes', () => {
  it('should reject GET /me without a token (401)', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/no token/i);
  });

  it('should reject GET /me with a malformed Authorization header', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'NotBearer xyz');

    expect(response.status).toBe(401);
  });

  it('should reject GET /me with an invalid token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.valid.token');

    expect(response.status).toBe(401);
  });

  it('should accept GET /me with a valid token and return user without password', async () => {
    await seedOwner();
    const token = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toHaveProperty('email', OWNER_EMAIL);
    expect(response.body.user).toHaveProperty('role', 'owner');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('should accept POST /logout with a valid token', async () => {
    await seedOwner();
    const token = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/logged out/i);
  });
});


// =========================================================================
// ADMIN: CREATE TENANT (POST /api/admin/tenants)
// =========================================================================
describe('Admin Module - Create Tenant', () => {
  let ownerToken;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
  });

  it('should create a new tenant when called by an owner', async () => {
    const response = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: TENANT_NAME, email: TENANT_EMAIL });

    expect(response.status).toBe(201);
    expect(response.body.message).toMatch(/invited successfully/i);
    expect(response.body.tenant).toHaveProperty('email', TENANT_EMAIL);
    expect(response.body.tenant).toHaveProperty('name', TENANT_NAME);
    expect(response.body.tenant).toHaveProperty('role', 'client');
    expect(response.body.tenant).toHaveProperty('mustSetPassword', true);
    expect(response.body).toHaveProperty('inviteLink');
    expect(response.body.inviteLink).toMatch(/\/set-password\?token=/);
    expect(response.body).toHaveProperty('inviteExpiresAt');
  });

  it('should persist the tenant in the database with mustSetPassword=true and a token', async () => {
    await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: TENANT_NAME, email: TENANT_EMAIL });

    const dbUser = await User.findOne({ email: TENANT_EMAIL });
    expect(dbUser).not.toBeNull();
    expect(dbUser.role).toBe('client');
    expect(dbUser.mustSetPassword).toBe(true);
    expect(dbUser.password).toBeNull();
    expect(dbUser.inviteToken).toBeTruthy();
    expect(dbUser.inviteToken.length).toBe(64); // 32 bytes hex
    expect(dbUser.inviteTokenExpiry.getTime()).toBeGreaterThan(Date.now());
  });

  it('should reject when no Authorization token is provided (401)', async () => {
    const response = await request(app)
      .post('/api/admin/tenants')
      .send({ email: TENANT_EMAIL, name: TENANT_NAME });

    expect(response.status).toBe(401);
  });

  it('should reject when called by a non-owner (403)', async () => {
    // Create a client user and log them in
    const hashed = await bcrypt.hash(VALID_PASSWORD, 10);
    await User.create({
      email: TENANT_EMAIL,
      password: hashed,
      role: 'client',
      mustSetPassword: false
    });
    const clientToken = await loginAs(TENANT_EMAIL, VALID_PASSWORD);

    const response = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ email: 'newguy@uni.edu', name: 'New Guy' });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/owners only/i);
  });

  it('should reject 400 when email is missing', async () => {
    const response = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: TENANT_NAME });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/email is required/i);
  });

  it('should reject 400 when email format is invalid', async () => {
    const response = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'not-an-email', name: TENANT_NAME });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/valid email/i);
  });

  it('should return 409 when email already belongs to a fully-active account', async () => {
    // Create a fully-onboarded tenant
    const hashed = await bcrypt.hash(VALID_PASSWORD, 10);
    await User.create({
      email: TENANT_EMAIL,
      password: hashed,
      role: 'client',
      mustSetPassword: false
    });

    const response = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: TENANT_EMAIL, name: 'Trying Again' });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists/i);
  });

  it('should re-issue a fresh token when re-inviting an un-onboarded tenant', async () => {
    // First invitation
    const first = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: TENANT_EMAIL, name: TENANT_NAME });
    const firstToken = extractToken(first.body.inviteLink);

    // Second invitation (same email, still un-onboarded)
    const second = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: TENANT_EMAIL, name: TENANT_NAME });
    const secondToken = extractToken(second.body.inviteLink);

    expect(second.status).toBe(201);
    expect(secondToken).not.toBe(firstToken);

    // Old token should no longer be valid in DB
    const dbUser = await User.findOne({ email: TENANT_EMAIL });
    expect(dbUser.inviteToken).toBe(secondToken);
  });

  it('should normalize email to lowercase', async () => {
    const response = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: TENANT_EMAIL.toUpperCase(), name: TENANT_NAME });

    expect(response.status).toBe(201);
    expect(response.body.tenant.email).toBe(TENANT_EMAIL);
  });
});


// =========================================================================
// PUBLIC: SET PASSWORD WITH TOKEN (POST /api/auth/set-password)
// =========================================================================
describe('Auth Module - Set Password with Invite Token', () => {
  let inviteToken;
  let ownerToken;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);

    // Create a tenant to get a real invite token
    const inviteRes = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: TENANT_EMAIL, name: TENANT_NAME });
    inviteToken = extractToken(inviteRes.body.inviteLink);
  });

  it('should set the password successfully with a valid token', async () => {
    const response = await request(app)
      .post('/api/auth/set-password')
      .send({ token: inviteToken, password: VALID_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/successfully/i);
  });

  it('should clear invite fields after successful password set', async () => {
    await request(app)
      .post('/api/auth/set-password')
      .send({ token: inviteToken, password: VALID_PASSWORD });

    const dbUser = await User.findOne({ email: TENANT_EMAIL });
    expect(dbUser.mustSetPassword).toBe(false);
    expect(dbUser.inviteToken).toBeNull();
    expect(dbUser.inviteTokenExpiry).toBeNull();
    expect(dbUser.password).toBeTruthy();
    expect(dbUser.password).not.toBe(VALID_PASSWORD); // should be hashed
  });

  it('should allow tenant to log in after password is set', async () => {
    await request(app)
      .post('/api/auth/set-password')
      .send({ token: inviteToken, password: VALID_PASSWORD });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TENANT_EMAIL, password: VALID_PASSWORD });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
    expect(loginRes.body.user).toHaveProperty('role', 'client');
  });

  it('should reject reuse of the same token (one-time use)', async () => {
    // First use succeeds
    await request(app)
      .post('/api/auth/set-password')
      .send({ token: inviteToken, password: VALID_PASSWORD });

    // Second use fails
    const response = await request(app)
      .post('/api/auth/set-password')
      .send({ token: inviteToken, password: 'AnotherPass1!' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid or expired/i);
  });

  it('should reject an unknown token with generic error', async () => {
    const response = await request(app)
      .post('/api/auth/set-password')
      .send({ token: 'completely-fake-token', password: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid or expired/i);
  });

  it('should reject an expired token', async () => {
    // Manually expire the token in the database
    await User.updateOne(
      { email: TENANT_EMAIL },
      { $set: { inviteTokenExpiry: new Date(Date.now() - 1000) } }
    );

    const response = await request(app)
      .post('/api/auth/set-password')
      .send({ token: inviteToken, password: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid or expired/i);
  });

  it('should reject when token or password is missing', async () => {
    const r1 = await request(app)
      .post('/api/auth/set-password')
      .send({ token: inviteToken });
    expect(r1.status).toBe(400);

    const r2 = await request(app)
      .post('/api/auth/set-password')
      .send({ password: VALID_PASSWORD });
    expect(r2.status).toBe(400);
  });

  describe('password strength rules', () => {
    const weakPasswords = [
      { label: 'too short', value: 'Aa1!' },
      { label: 'no uppercase', value: 'mysecure1!' },
      { label: 'no lowercase', value: 'MYSECURE1!' },
      { label: 'no number', value: 'MySecure!' },
      { label: 'no special character', value: 'MySecure1' }
    ];

    weakPasswords.forEach(({ label, value }) => {
      it(`should reject password: ${label}`, async () => {
        const response = await request(app)
          .post('/api/auth/set-password')
          .send({ token: inviteToken, password: value });

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/does not meet requirements/i);
        expect(response.body.errors).toBeDefined();
        expect(Array.isArray(response.body.errors)).toBe(true);
      });
    });

    it('should accept a password that meets all rules', async () => {
      const response = await request(app)
        .post('/api/auth/set-password')
        .send({ token: inviteToken, password: 'StrongPass1!' });

      expect(response.status).toBe(200);
    });
  });
});
// =========================================================================
// ADMIN: LIST TENANTS (GET /api/admin/tenants)
// =========================================================================
describe('Admin Module - List Tenants', () => {
  let ownerToken;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
  });

  it('should return an empty array when there are no tenants', async () => {
    const response = await request(app)
      .get('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('tenants');
    expect(Array.isArray(response.body.tenants)).toBe(true);
    expect(response.body.tenants).toHaveLength(0);
  });

  it('should return tenants with pending status when they have not set a password', async () => {
    // Create a tenant via the createTenant flow
    await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: TENANT_NAME, email: TENANT_EMAIL });

    const response = await request(app)
      .get('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.tenants).toHaveLength(1);
    expect(response.body.tenants[0]).toMatchObject({
      name: TENANT_NAME,
      email: TENANT_EMAIL,
      status: 'pending'
    });
    expect(response.body.tenants[0]).toHaveProperty('inviteExpiresAt');
    expect(response.body.tenants[0]).not.toHaveProperty('password');
    expect(response.body.tenants[0]).not.toHaveProperty('inviteToken');
  });

  it('should return tenants with active status after they set a password', async () => {
    // Create + onboard a tenant
    const createRes = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: TENANT_NAME, email: TENANT_EMAIL });
    const inviteToken = extractToken(createRes.body.inviteLink);
    await request(app)
      .post('/api/auth/set-password')
      .send({ token: inviteToken, password: VALID_PASSWORD });

    // Now list tenants
    const response = await request(app)
      .get('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.body.tenants).toHaveLength(1);
    expect(response.body.tenants[0].status).toBe('active');
    expect(response.body.tenants[0].inviteExpiresAt).toBeNull();
  });

  it('should reject non-owners with 403', async () => {
    // Create + onboard a client, then log in as them
    const createRes = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: TENANT_NAME, email: TENANT_EMAIL });
    const inviteToken = extractToken(createRes.body.inviteLink);
    await request(app)
      .post('/api/auth/set-password')
      .send({ token: inviteToken, password: VALID_PASSWORD });
    const clientToken = await loginAs(TENANT_EMAIL, VALID_PASSWORD);

    const response = await request(app)
      .get('/api/admin/tenants')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(response.status).toBe(403);
  });

  it('should reject anonymous requests with 401', async () => {
    const response = await request(app).get('/api/admin/tenants');
    expect(response.status).toBe(401);
  });
});