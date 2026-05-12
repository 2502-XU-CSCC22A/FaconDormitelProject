jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Room = require('../models/Room');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const { sendEmail } = require('../services/emailService');
const app = require('../server');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_jest_runs_only';

const OWNER_EMAIL = 'owner@dormisync.local';
const OWNER_PASSWORD = 'OwnerStrong1!';
const VALID_PASSWORD = 'TenantPass1!';

// Content-type header drives multer's file filter; actual bytes are irrelevant
const JPEG_FIXTURE = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);

async function seedOwner(email = OWNER_EMAIL, password = OWNER_PASSWORD) {
  const hashed = await bcrypt.hash(password, 10);
  return User.create({ email, password: hashed, role: 'owner', name: 'Test Owner', mustSetPassword: false });
}

async function loginAs(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

async function seedRoom(roomNumber = 'A101') {
  return Room.create({ roomNumber, capacity: 4 });
}

async function seedTenant(email, roomId = null) {
  const hashed = await bcrypt.hash(VALID_PASSWORD, 10);
  return User.create({
    email,
    name: email.split('@')[0],
    password: hashed,
    role: 'client',
    mustSetPassword: false,
    roomId
  });
}

function seedBill(ownerToken, roomId, billingMonth = '2026-05') {
  return request(app)
    .post('/api/admin/bills')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ roomId, billingMonth, electricity: { previousReading: 0, currentReading: 100 } });
}

function yesterday() {
  return new Date(Date.now() - 86400000).toISOString().split('T')[0];
}

function tomorrow() {
  return new Date(Date.now() + 86400000).toISOString().split('T')[0];
}

function submitPayment(token, shareId, opts = {}) {
  return request(app)
    .post('/api/me/payments')
    .set('Authorization', `Bearer ${token}`)
    .field('shareId', shareId.toString())
    .field('amount', opts.amount !== undefined ? String(opts.amount) : '500')
    .field('paymentDate', opts.paymentDate || yesterday())
    .attach('proof', opts.file || JPEG_FIXTURE, {
      filename: opts.filename || 'proof.jpg',
      contentType: opts.contentType || 'image/jpeg'
    });
}

beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/dormisync_test');
  await User.collection.dropIndexes().catch(() => {});
  await Room.collection.dropIndexes().catch(() => {});
  await Bill.collection.dropIndexes().catch(() => {});
  await Payment.collection.dropIndexes().catch(() => {});
  await User.syncIndexes();
  await Room.syncIndexes();
  await Bill.syncIndexes();
  await Payment.syncIndexes();
});

beforeEach(async () => {
  await Payment.deleteMany({});
  await Bill.deleteMany({});
  await Room.deleteMany({});
  await User.deleteMany({});
  sendEmail.mockClear();
});

afterAll(async () => {
  await Payment.deleteMany({});
  await Bill.deleteMany({});
  await Room.deleteMany({});
  await User.deleteMany({});
  await mongoose.connection.close();
});


// =========================================================================
// POST /api/me/payments
// =========================================================================
describe('Payments Module - POST /api/me/payments', () => {
  let ownerToken, tenantToken, share, billId, room;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    room = await seedRoom('A101');
    await seedTenant('tenant1@test.com', room._id);
    tenantToken = await loginAs('tenant1@test.com', VALID_PASSWORD);
    const billRes = await seedBill(ownerToken, room._id, '2026-05');
    billId = billRes.body.bill._id;
    share = billRes.body.bill.shares.find(s => s.tenantEmail === 'tenant1@test.com');
  });

  it('should return 201 with status submitted and a proofImagePath', async () => {
    const res = await submitPayment(tenantToken, share._id);
    expect(res.status).toBe(201);
    expect(res.body.payment.status).toBe('submitted');
    expect(res.body.payment.proofImagePath).toMatch(/^payment-proofs\//);
    expect(res.body.payment.billId).toBe(billId.toString());
  });

  it('should return 400 when no file is uploaded', async () => {
    const res = await request(app)
      .post('/api/me/payments')
      .set('Authorization', `Bearer ${tenantToken}`)
      .field('shareId', share._id.toString())
      .field('amount', '500')
      .field('paymentDate', yesterday());
    expect(res.status).toBe(400);
  });

  it('should return 400 when file is not jpeg or png', async () => {
    const res = await submitPayment(tenantToken, share._id, {
      filename: 'test.gif',
      contentType: 'image/gif'
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 when amount is missing or <= 0', async () => {
    const missingAmount = await request(app)
      .post('/api/me/payments')
      .set('Authorization', `Bearer ${tenantToken}`)
      .field('shareId', share._id.toString())
      .field('paymentDate', yesterday())
      .attach('proof', JPEG_FIXTURE, { filename: 'proof.jpg', contentType: 'image/jpeg' });
    expect(missingAmount.status).toBe(400);

    const zeroAmount = await submitPayment(tenantToken, share._id, { amount: 0 });
    expect(zeroAmount.status).toBe(400);
  });

  it('should return 400 when paymentDate is in the future', async () => {
    const res = await submitPayment(tenantToken, share._id, { paymentDate: tomorrow() });
    expect(res.status).toBe(400);
  });

  it('should return 404 when shareId does not match any bill share', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await submitPayment(tenantToken, fakeId);
    expect(res.status).toBe(404);
  });

  it('should return 403 when the tenant does not own that share', async () => {
    await seedTenant('other@test.com', room._id);
    const otherToken = await loginAs('other@test.com', VALID_PASSWORD);
    const res = await submitPayment(otherToken, share._id);
    expect(res.status).toBe(403);
  });

  it('should return 409 when an active payment already exists for this share', async () => {
    await submitPayment(tenantToken, share._id);
    const res = await submitPayment(tenantToken, share._id);
    expect(res.status).toBe(409);
  });
});


// =========================================================================
// GET /api/me/payments
// =========================================================================
describe('Payments Module - GET /api/me/payments', () => {
  let ownerToken, tenantToken, room;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    room = await seedRoom('A101');
    await seedTenant('tenant1@test.com', room._id);
    tenantToken = await loginAs('tenant1@test.com', VALID_PASSWORD);
  });

  it("should return only the authenticated tenant's own payments", async () => {
    const bill1Res = await seedBill(ownerToken, room._id, '2026-05');
    const share1 = bill1Res.body.bill.shares.find(s => s.tenantEmail === 'tenant1@test.com');
    await submitPayment(tenantToken, share1._id);

    // Different tenant in a separate room — their payment must not appear
    const room2 = await seedRoom('B101');
    await seedTenant('tenant2@test.com', room2._id);
    const tenant2Token = await loginAs('tenant2@test.com', VALID_PASSWORD);
    const bill2Res = await seedBill(ownerToken, room2._id, '2026-05');
    await submitPayment(tenant2Token, bill2Res.body.bill.shares[0]._id);

    const res = await request(app)
      .get('/api/me/payments')
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(1);
  });

  it('should return payments sorted by submittedAt desc', async () => {
    const bill1Res = await seedBill(ownerToken, room._id, '2026-04');
    const bill2Res = await seedBill(ownerToken, room._id, '2026-05');
    const share1 = bill1Res.body.bill.shares.find(s => s.tenantEmail === 'tenant1@test.com');
    const share2 = bill2Res.body.bill.shares.find(s => s.tenantEmail === 'tenant1@test.com');
    const tenant = await User.findOne({ email: 'tenant1@test.com' });

    // Insert with controlled timestamps to ensure deterministic ordering
    await Payment.create({
      tenantId: tenant._id,
      shareId: share1._id,
      billId: bill1Res.body.bill._id,
      ownerId: bill1Res.body.bill.ownerId,
      amount: 500,
      paymentDate: new Date('2026-04-01'),
      proofImagePath: 'payment-proofs/older.jpg',
      submittedAt: new Date('2026-04-01T10:00:00Z')
    });
    await Payment.create({
      tenantId: tenant._id,
      shareId: share2._id,
      billId: bill2Res.body.bill._id,
      ownerId: bill2Res.body.bill.ownerId,
      amount: 500,
      paymentDate: new Date('2026-05-01'),
      proofImagePath: 'payment-proofs/newer.jpg',
      submittedAt: new Date('2026-05-01T10:00:00Z')
    });

    const res = await request(app)
      .get('/api/me/payments')
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(2);
    const dates = res.body.payments.map(p => new Date(p.submittedAt).getTime());
    expect(dates[0]).toBeGreaterThan(dates[1]);
  });
});


// =========================================================================
// GET /api/admin/payments
// =========================================================================
describe('Payments Module - GET /api/admin/payments', () => {
  let ownerToken, tenantToken, share;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    const room = await seedRoom('A101');
    await seedTenant('tenant1@test.com', room._id);
    tenantToken = await loginAs('tenant1@test.com', VALID_PASSWORD);
    const billRes = await seedBill(ownerToken, room._id, '2026-05');
    share = billRes.body.bill.shares.find(s => s.tenantEmail === 'tenant1@test.com');
  });

  it('should only return payments scoped to the authenticated owner', async () => {
    await submitPayment(tenantToken, share._id);

    await seedOwner('owner2@dormisync.local', OWNER_PASSWORD);
    const owner2Token = await loginAs('owner2@dormisync.local', OWNER_PASSWORD);
    const room2 = await seedRoom('B101');
    await seedTenant('tenant2@test.com', room2._id);
    const tenant2Token = await loginAs('tenant2@test.com', VALID_PASSWORD);
    const bill2Res = await seedBill(owner2Token, room2._id, '2026-05');
    await submitPayment(tenant2Token, bill2Res.body.bill.shares[0]._id);

    const res = await request(app)
      .get('/api/admin/payments')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(1);
  });

  it('should filter payments by status query param', async () => {
    const submitRes = await submitPayment(tenantToken, share._id);
    const paymentId = submitRes.body.payment._id;

    await request(app)
      .post(`/api/admin/payments/${paymentId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const approvedRes = await request(app)
      .get('/api/admin/payments?status=approved')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(approvedRes.status).toBe(200);
    expect(approvedRes.body.payments).toHaveLength(1);
    expect(approvedRes.body.payments[0].status).toBe('approved');

    const submittedRes = await request(app)
      .get('/api/admin/payments?status=submitted')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(submittedRes.body.payments).toHaveLength(0);
  });
});


// =========================================================================
// POST /api/admin/payments/:id/approve
// =========================================================================
describe('Payments Module - POST /api/admin/payments/:id/approve', () => {
  let ownerToken, tenantToken, share, billId;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    const room = await seedRoom('A101');
    await seedTenant('tenant1@test.com', room._id);
    tenantToken = await loginAs('tenant1@test.com', VALID_PASSWORD);
    const billRes = await seedBill(ownerToken, room._id, '2026-05');
    billId = billRes.body.bill._id;
    share = billRes.body.bill.shares.find(s => s.tenantEmail === 'tenant1@test.com');
  });

  it('should approve payment and flip share.status to paid on the Bill', async () => {
    const { body: { payment: { _id: paymentId } } } = await submitPayment(tenantToken, share._id);

    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('approved');

    const bill = await Bill.findById(billId);
    const updatedShare = bill.shares.id(share._id);
    expect(updatedShare.status).toBe('paid');
    expect(updatedShare.paidAt).toBeTruthy();
  });

  it('should return 400 when payment is not in submitted state', async () => {
    const { body: { payment: { _id: paymentId } } } = await submitPayment(tenantToken, share._id);

    await request(app)
      .post(`/api/admin/payments/${paymentId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(400);
  });

  it('should return 404 when a different owner tries to approve', async () => {
    const { body: { payment: { _id: paymentId } } } = await submitPayment(tenantToken, share._id);

    await seedOwner('owner2@dormisync.local', OWNER_PASSWORD);
    const owner2Token = await loginAs('owner2@dormisync.local', OWNER_PASSWORD);

    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/approve`)
      .set('Authorization', `Bearer ${owner2Token}`);

    expect(res.status).toBe(404);
  });
});


// =========================================================================
// POST /api/admin/payments/:id/reject
// =========================================================================
describe('Payments Module - POST /api/admin/payments/:id/reject', () => {
  let ownerToken, tenantToken, paymentId;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    const room = await seedRoom('A101');
    await seedTenant('tenant1@test.com', room._id);
    tenantToken = await loginAs('tenant1@test.com', VALID_PASSWORD);
    const billRes = await seedBill(ownerToken, room._id, '2026-05');
    const share = billRes.body.bill.shares.find(s => s.tenantEmail === 'tenant1@test.com');
    const submitRes = await submitPayment(tenantToken, share._id);
    paymentId = submitRes.body.payment._id;
  });

  it('should reject payment and set rejectReason', async () => {
    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/reject`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Blurry image' });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('rejected');
    expect(res.body.payment.rejectReason).toBe('Blurry image');
  });

  it('should return 400 when no reason is provided', async () => {
    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/reject`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return emailSent: true when email service succeeds', async () => {
    sendEmail.mockResolvedValueOnce({ success: true });

    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/reject`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Invalid proof' });

    expect(res.status).toBe(200);
    expect(res.body.emailSent).toBe(true);
  });

  it('should return emailSent: false but still 200 when email service throws', async () => {
    sendEmail.mockRejectedValueOnce(new Error('SMTP connection failed'));

    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/reject`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Invalid proof' });

    expect(res.status).toBe(200);
    expect(res.body.emailSent).toBe(false);
  });
});


// =========================================================================
// POST /api/admin/payments/:id/void
// =========================================================================
describe('Payments Module - POST /api/admin/payments/:id/void', () => {
  let ownerToken, tenantToken, share, billId, paymentId;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    const room = await seedRoom('A101');
    await seedTenant('tenant1@test.com', room._id);
    tenantToken = await loginAs('tenant1@test.com', VALID_PASSWORD);
    const billRes = await seedBill(ownerToken, room._id, '2026-05');
    billId = billRes.body.bill._id;
    share = billRes.body.bill.shares.find(s => s.tenantEmail === 'tenant1@test.com');
    const submitRes = await submitPayment(tenantToken, share._id);
    paymentId = submitRes.body.payment._id;
    await request(app)
      .post(`/api/admin/payments/${paymentId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`);
  });

  it('should void payment and flip share.status back to pending', async () => {
    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/void`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Duplicate submission' });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('voided');

    const bill = await Bill.findById(billId);
    const updatedShare = bill.shares.id(share._id);
    expect(updatedShare.status).toBe('pending');
    expect(updatedShare.paidAt).toBeNull();
  });

  it('should return 400 when payment is not in approved state', async () => {
    await request(app)
      .post(`/api/admin/payments/${paymentId}/void`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'First void' });

    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/void`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Second attempt' });

    expect(res.status).toBe(400);
  });
});
