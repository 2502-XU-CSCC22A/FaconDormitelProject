
jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  buildInviteEmail: jest.fn().mockReturnValue({
    subject: 'Test Subject',
    html: '<p>Test HTML</p>',
    text: 'Test plain text'
  })
}));
// Mock DNS so tests don't depend on network reachability.
// hasValidMxRecord uses dns.resolveMx — intercept that to return predictable results.
jest.mock('dns', () => ({
  promises: {
    resolveMx: jest.fn(async (domain) => {
      // Domains that should fail MX validation in tests
      const invalidDomains = ['gmial.com', 'thisdoesnotexist123abcxyz.fake'];
      if (invalidDomains.includes(domain)) {
        const err = new Error('ENOTFOUND');
        err.code = 'ENOTFOUND';
        throw err;
      }
      // Everything else (gmail.com, uni.edu, etc.) returns valid MX records
      return [{ exchange: `mx.${domain}`, priority: 10 }];
    })
  }
}));

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Bill = require('../models/Bill');
const app = require('../server');

// Import the mocked functions so we can inspect/configure them in tests
const { sendEmail, buildInviteEmail } = require('../services/emailService');

// JWT secret for the test environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_jest_runs_only';

// Shared fixtures
const OWNER_EMAIL = 'owner@dormisync.local';
const OWNER_PASSWORD = 'OwnerStrong1!';
const TENANT_EMAIL = 'tenant1@gmail.com';
const TENANT_NAME = 'Test Tenant';
const VALID_PASSWORD = 'MySecure1!';

// Helper: seed an owner directly in the database
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

// Helper: extract token from an invite link
function extractToken(inviteLink) {
  return inviteLink.split('token=')[1];
}

// Test setup
beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/dormisync_test');
  await User.collection.dropIndexes().catch(() => { /* ignore if no indexes exist yet */ });
  await User.syncIndexes();
});

beforeEach(async () => {
  await User.deleteMany({});
  // Reset email mock between tests so call counts are accurate
  sendEmail.mockClear();
  buildInviteEmail.mockClear();
  sendEmail.mockResolvedValue({ success: true });
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
// PROTECTED ROUTES
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
// ADMIN: CREATE TENANT
// =========================================================================
describe('Admin Module - Create Tenant', () => {
  let ownerToken;
  it('should reject 400 when email domain has no MX records', async () => {
    // gmial.com is a real-world typo — domain doesn't exist / has no MX
    const response = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: TENANT_NAME, email: 'someone@gmial.com' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/does not appear to accept mail/i);
  }, 15000);   // 15s timeout — DNS lookups can take a few seconds

  it('should reject 400 for completely fake/nonexistent domain', async () => {
    const response = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: TENANT_NAME, email: 'someone@thisdoesnotexist123abcxyz.fake' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/does not appear to accept mail/i);
  }, 15000);

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
    expect(dbUser.inviteToken.length).toBe(64);
    expect(dbUser.inviteTokenExpiry.getTime()).toBeGreaterThan(Date.now());
  });

  it('should reject when no Authorization token is provided (401)', async () => {
    const response = await request(app)
      .post('/api/admin/tenants')
      .send({ email: TENANT_EMAIL, name: TENANT_NAME });
    expect(response.status).toBe(401);
  });

  it('should reject when called by a non-owner (403)', async () => {
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

  it('should reject 400 when name is missing or too short', async () => {
    const r1 = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: TENANT_EMAIL });
    expect(r1.status).toBe(400);
    expect(r1.body.message).toMatch(/name is required/i);

    const r2 = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: TENANT_EMAIL, name: '   ' });
    expect(r2.status).toBe(400);

    const r3 = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: TENANT_EMAIL, name: 'A' });
    expect(r3.status).toBe(400);
  });

  it('should return 409 when email already belongs to a fully-active account', async () => {
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
    const first = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: TENANT_EMAIL, name: TENANT_NAME });
    const firstToken = extractToken(first.body.inviteLink);

    const second = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: TENANT_EMAIL, name: TENANT_NAME });
    const secondToken = extractToken(second.body.inviteLink);

    expect(second.status).toBe(201);
    expect(secondToken).not.toBe(firstToken);

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
// PUBLIC: SET PASSWORD WITH TOKEN
// =========================================================================
describe('Auth Module - Set Password with Invite Token', () => {
  let inviteToken;
  let ownerToken;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);

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
    expect(dbUser.password).not.toBe(VALID_PASSWORD);
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
    await request(app)
      .post('/api/auth/set-password')
      .send({ token: inviteToken, password: VALID_PASSWORD });

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
// ADMIN: LIST TENANTS
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
  });

  it('should return tenants with active status after they set a password', async () => {
    const createRes = await request(app)
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: TENANT_NAME, email: TENANT_EMAIL });
    const inviteToken = extractToken(createRes.body.inviteLink);
    await request(app)
      .post('/api/auth/set-password')
      .send({ token: inviteToken, password: VALID_PASSWORD });

    const response = await request(app)
      .get('/api/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.body.tenants).toHaveLength(1);
    expect(response.body.tenants[0].status).toBe('active');
    expect(response.body.tenants[0].inviteExpiresAt).toBeNull();
  });

  it('should reject non-owners with 403', async () => {
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


// =========================================================================
// ADMIN: DELETE TENANT
// =========================================================================
describe('Admin Module - Delete Tenant', () => {
  let ownerToken;
  let tenantId;

  beforeEach(async () => {
    await Bill.deleteMany({});
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);

    const hashed = await bcrypt.hash(VALID_PASSWORD, 10);
    const tenant = await User.create({
      email: TENANT_EMAIL,
      name: TENANT_NAME,
      password: hashed,
      role: 'client',
      mustSetPassword: false
    });
    tenantId = tenant._id.toString();
  });

  afterEach(async () => {
    await Bill.deleteMany({});
  });

  it('should delete a tenant successfully', async () => {
    const res = await request(app)
      .delete(`/api/admin/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/removed/i);
    expect(res.body.tenant).toHaveProperty('_id');
    expect(res.body.tenant).toHaveProperty('email', TENANT_EMAIL);

    const dbUser = await User.findById(tenantId);
    expect(dbUser).toBeNull();
  });

  it('should reject 409 when tenant has unpaid bills', async () => {
    const fakeRoomId = new mongoose.Types.ObjectId();
    const ownerDoc = await User.findOne({ role: 'owner' });
    await Bill.create({
      ownerId: ownerDoc._id,
      roomId: fakeRoomId,
      roomNameSnapshot: 'Room 101',
      billingMonth: '2026-05',
      flatFee: 3000,
      electricity: { previousReading: 100, currentReading: 200, ratePerKwh: 11, amount: 1100 },
      totalAmount: 4100,
      dueDate: new Date('2026-05-31'),
      shares: [{
        tenantId: new mongoose.Types.ObjectId(tenantId),
        tenantEmail: TENANT_EMAIL,
        tenantName: TENANT_NAME,
        amount: 4100,
        status: 'pending'
      }]
    });

    const res = await request(app)
      .delete(`/api/admin/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/unpaid bills/i);
    expect(res.body.unpaidCount).toBe(1);
    expect(res.body.unpaidTotal).toBe(4100);

    const dbUser = await User.findById(tenantId);
    expect(dbUser).not.toBeNull();
  });

  it('should return 404 when tenant ID does not exist', async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .delete(`/api/admin/tenants/${nonExistentId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('should return 404 when target user is an owner, not a tenant', async () => {
    const ownerDoc = await User.findOne({ role: 'owner' });
    const res = await request(app)
      .delete(`/api/admin/tenants/${ownerDoc._id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('should reject 401 without auth token', async () => {
    const res = await request(app)
      .delete(`/api/admin/tenants/${tenantId}`);

    expect(res.status).toBe(401);
  });

  it('should reject 403 when caller is not an owner', async () => {
    const clientToken = await loginAs(TENANT_EMAIL, VALID_PASSWORD);
    const res = await request(app)
      .delete(`/api/admin/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
  });
});