jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  buildInviteEmail: jest.fn().mockReturnValue({ subject: 'Test Subject', html: '<p>Test HTML</p>', text: 'Test plain text' }),
  buildBillCreatedEmail: jest.fn().mockReturnValue({ subject: '', html: '', text: '' }),
  buildOverdueReminderEmail: jest.fn().mockReturnValue({ subject: '', html: '', text: '' }),
  buildArrearsNoticeEmail: jest.fn().mockReturnValue({ subject: '', html: '', text: '' }),
  buildPaymentConfirmationEmail: jest.fn().mockReturnValue({ subject: '', html: '', text: '' }),
  buildReminderEmail: jest.fn().mockReturnValue({ subject: '', html: '', text: '' })
}));

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Room = require('../models/Room');
const Bill = require('../models/Bill');
const app = require('../server');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_jest_runs_only';

const OWNER_EMAIL = 'owner@dormisync.local';
const OWNER_PASSWORD = 'OwnerStrong1!';
const VALID_PASSWORD = 'TenantPass1!';

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

function postBill(token, roomId, billingMonth, electricity) {
  return request(app)
    .post('/api/admin/bills')
    .set('Authorization', `Bearer ${token}`)
    .send({ roomId, billingMonth, electricity });
}

beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/dormisync_test');
  await User.collection.dropIndexes().catch(() => {});
  await Room.collection.dropIndexes().catch(() => {});
  await Bill.collection.dropIndexes().catch(() => {});
  await User.syncIndexes();
  await Room.syncIndexes();
  await Bill.syncIndexes();
});

beforeEach(async () => {
  await Bill.deleteMany({});
  await Room.deleteMany({});
  await User.deleteMany({});
});

afterAll(async () => {
  await Bill.deleteMany({});
  await Room.deleteMany({});
  await User.deleteMany({});
  await mongoose.connection.close();
});


// =========================================================================
// CREATE BILL
// =========================================================================
describe('Bills Module - createBill', () => {
  let ownerToken, room;
  it('should accept flatFee override from request body', async () => {
    const response = await request(app)
      .post('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        roomId: room._id.toString(),
        billingMonth: '2026-08',
        flatFee: 8500,   // override default
        electricity: { previousReading: 0, currentReading: 100 }
      });
    
    expect(response.status).toBe(201);
    expect(response.body.bill.flatFee).toBe(8500);
  });

  it('should accept electricity.ratePerKwh override from request body', async () => {
    const response = await request(app)
      .post('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        roomId: room._id.toString(),
        billingMonth: '2026-09',
        electricity: { previousReading: 0, currentReading: 100, ratePerKwh: 16 }   // override
      });
    
    expect(response.status).toBe(201);
    expect(response.body.bill.electricity.ratePerKwh).toBe(16);
    // 100 kWh × 16 = 1600
    expect(response.body.bill.electricity.amount).toBe(1600);
  });

  it('should reject 400 when flatFee override is negative', async () => {
    const response = await request(app)
      .post('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        roomId: room._id.toString(),
        billingMonth: '2026-10',
        flatFee: -100,
        electricity: { previousReading: 0, currentReading: 100 }
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/flatFee/i);
  });

  it('should reject 400 when ratePerKwh override is not a number', async () => {
    const response = await request(app)
      .post('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        roomId: room._id.toString(),
        billingMonth: '2026-11',
        electricity: { previousReading: 0, currentReading: 100, ratePerKwh: 'fifteen' }
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/ratePerKwh/i);
  });

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    room = await seedRoom('A101');
    await seedTenant('tenant1@test.com', room._id);
    await seedTenant('tenant2@test.com', room._id);
  });

  it('should return 201 with correctly computed amounts and snapshot fields', async () => {
    const res = await postBill(ownerToken, room._id, '2024-03', { previousReading: 100, currentReading: 200 });

    expect(res.status).toBe(201);
    const bill = res.body.bill;
    expect(bill.billingMonth).toBe('2024-03');
    expect(bill.roomNameSnapshot).toBe('A101');
    expect(bill.flatFee).toBe(7500);
    expect(bill.electricity.previousReading).toBe(100);
    expect(bill.electricity.currentReading).toBe(200);
    expect(bill.electricity.ratePerKwh).toBe(14);
    expect(bill.electricity.amount).toBe(1400);   // (200-100) * 14
    expect(bill.totalAmount).toBe(8900);           // 7500 + 1400
    expect(bill.shares).toHaveLength(2);
    bill.shares.forEach(s => expect(s.amount).toBeCloseTo(4450)); // 8900 / 2
    expect(bill.dueDate).toBeDefined();
  });

  it('should snapshot tenant email, name, and tenantId at creation time', async () => {
    const res = await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 0 });

    const shares = res.body.bill.shares;
    const emails = shares.map(s => s.tenantEmail).sort();
    expect(emails).toEqual(['tenant1@test.com', 'tenant2@test.com']);
    shares.forEach(s => {
      expect(s.tenantName).toBeTruthy();
      expect(s.tenantId).toBeTruthy();
      expect(s.status).toBe('pending');
    });
  });

  it('should auto-fill previousReading from the most recent prior bill when omitted', async () => {
    await postBill(ownerToken, room._id, '2024-02', { previousReading: 100, currentReading: 300 });

    const res = await postBill(ownerToken, room._id, '2024-03', { currentReading: 400 });

    expect(res.status).toBe(201);
    expect(res.body.bill.electricity.previousReading).toBe(300);
    expect(res.body.bill.electricity.currentReading).toBe(400);
  });

  it('should default previousReading to 0 when no prior bill exists for the room', async () => {
    const res = await postBill(ownerToken, room._id, '2024-03', { currentReading: 150 });

    expect(res.status).toBe(201);
    expect(res.body.bill.electricity.previousReading).toBe(0);
  });

  it('should return 409 when a bill already exists for the same (roomId, billingMonth)', async () => {
    await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 100 });
    const res = await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 200 });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('should return 400 when room has no occupants', async () => {
    await User.updateMany({ roomId: room._id }, { $set: { roomId: null } });

    const res = await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 100 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no occupants/i);
  });

  it('should return 400 for missing required fields (roomId, billingMonth, electricity)', async () => {
    const missing = [
      { billingMonth: '2024-03', electricity: { currentReading: 100 } },           // no roomId
      { roomId: room._id, electricity: { currentReading: 100 } },                  // no billingMonth
      { roomId: room._id, billingMonth: '2024-03' },                               // no electricity
    ];
    for (const body of missing) {
      const res = await request(app)
        .post('/api/admin/bills')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it('should return 400 for invalid billingMonth formats', async () => {
    const badMonths = ['2024-13', '2024-1', '24-03', 'not-a-date', '2024-00'];
    for (const billingMonth of badMonths) {
      const res = await postBill(ownerToken, room._id, billingMonth, { previousReading: 0, currentReading: 100 });
      expect(res.status).toBe(400);
    }
  });

  it('should return 400 when currentReading is less than previousReading', async () => {
    const res = await postBill(ownerToken, room._id, '2024-03', { previousReading: 500, currentReading: 100 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/currentReading/i);
  });

  it('should return 401 when no Authorization token is provided', async () => {
    const res = await request(app)
      .post('/api/admin/bills')
      .send({ roomId: room._id, billingMonth: '2024-03', electricity: { previousReading: 0, currentReading: 100 } });
    expect(res.status).toBe(401);
  });

  it('should return 403 when called by a non-owner (tenant)', async () => {
    const tenantToken = await loginAs('tenant1@test.com', VALID_PASSWORD);
    const res = await request(app)
      .post('/api/admin/bills')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ roomId: room._id, billingMonth: '2024-03', electricity: { previousReading: 0, currentReading: 100 } });
    expect(res.status).toBe(403);
  });
});


// =========================================================================
// LIST BILLS
// =========================================================================
describe('Bills Module - listBills', () => {
  let ownerToken, room;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    room = await seedRoom('A101');
    await seedTenant('tenant1@test.com', room._id);
  });

  it('should return only the authenticated owner\'s own bills (owner-scoped)', async () => {
    await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 100 });

    // Second owner creates a bill for a separate room
    await seedOwner('owner2@dormisync.local', OWNER_PASSWORD);
    const ownerToken2 = await loginAs('owner2@dormisync.local', OWNER_PASSWORD);
    const room2 = await seedRoom('B101');
    await seedTenant('tenant2@test.com', room2._id);
    await postBill(ownerToken2, room2._id, '2024-03', { previousReading: 0, currentReading: 200 });

    const res = await request(app)
      .get('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.bills).toHaveLength(1);
    expect(res.body.bills[0].roomNameSnapshot).toBe('A101');
  });

  it('should tick share status to overdue when dueDate is in the past within grace', async () => {
    const createRes = await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 100 });
    // 2 days ago, default grace = 5 → overdue window
    await Bill.updateOne({ _id: createRes.body.bill._id }, { $set: { dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } });

    const res = await request(app)
      .get('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    res.body.bills[0].shares.forEach(s => expect(s.status).toBe('overdue'));
  });

  it('should leave share status as pending when dueDate is in the future', async () => {
    await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 100 });

    const res = await request(app)
      .get('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`);

    res.body.bills[0].shares.forEach(s => expect(s.status).toBe('pending'));
  });
});


// =========================================================================
// GET BILL
// =========================================================================
describe('Bills Module - getBill', () => {
  let ownerToken, room;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    room = await seedRoom('A101');
    await seedTenant('tenant1@test.com', room._id);
  });

  it('should return the bill by id for the owning owner', async () => {
    const createRes = await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 100 });
    const billId = createRes.body.bill._id;

    const res = await request(app)
      .get(`/api/admin/bills/${billId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.bill._id).toBe(billId);
    expect(res.body.bill.billingMonth).toBe('2024-03');
  });

  it('should return 404 when a different owner queries the bill by id', async () => {
    const createRes = await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 100 });
    const billId = createRes.body.bill._id;

    await seedOwner('owner2@dormisync.local', OWNER_PASSWORD);
    const ownerToken2 = await loginAs('owner2@dormisync.local', OWNER_PASSWORD);

    const res = await request(app)
      .get(`/api/admin/bills/${billId}`)
      .set('Authorization', `Bearer ${ownerToken2}`);

    expect(res.status).toBe(404);
  });
});


// =========================================================================
// MARK SHARE AS PAID
// =========================================================================
describe('Bills Module - markShareAsPaid', () => {
  let ownerToken, bill;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    const room = await seedRoom('A101');
    await seedTenant('tenant1@test.com', room._id);
    const createRes = await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 100 });
    bill = createRes.body.bill;
  });

  it('should mark a share as paid and record paidAt', async () => {
    const shareId = bill.shares[0]._id;

    const res = await request(app)
      .post(`/api/admin/bills/${bill._id}/shares/${shareId}/pay`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const updated = res.body.bill.shares.find(s => s._id === shareId);
    expect(updated.status).toBe('paid');
    expect(updated.paidAt).toBeTruthy();
  });

  it('should return 400 with existing paidAt when share is already paid', async () => {
    const shareId = bill.shares[0]._id;
    await request(app)
      .post(`/api/admin/bills/${bill._id}/shares/${shareId}/pay`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const res = await request(app)
      .post(`/api/admin/bills/${bill._id}/shares/${shareId}/pay`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already marked as paid/i);
    expect(res.body.paidAt).toBeTruthy();
  });

  it('should return 404 for an unknown billId', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const shareId = bill.shares[0]._id;

    const res = await request(app)
      .post(`/api/admin/bills/${fakeId}/shares/${shareId}/pay`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 404 for an unknown shareId within a valid bill', async () => {
    const fakeShareId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/api/admin/bills/${bill._id}/shares/${fakeShareId}/pay`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });
});


// =========================================================================
// GET MY BILLS (TENANT VIEW)
// =========================================================================
describe('Bills Module - getMyBills', () => {
  let ownerToken;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
  });

  it('should return only bills that include the authenticated tenant in shares', async () => {
    const room = await seedRoom('A101');
    await seedTenant('tenant1@test.com', room._id);
    const tenantToken = await loginAs('tenant1@test.com', VALID_PASSWORD);

    // Another tenant in a separate room — their bill must not appear
    const room2 = await seedRoom('B101');
    await seedTenant('other@test.com', room2._id);
    await postBill(ownerToken, room2._id, '2024-03', { previousReading: 0, currentReading: 100 });

    await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 100 });

    const res = await request(app)
      .get('/api/me/bills')
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.bills).toHaveLength(1);
    expect(res.body.bills[0].shares.some(s => s.tenantEmail === 'tenant1@test.com')).toBe(true);
  });

  it('should compute overdueAmount and totalDue in a single pass', async () => {
    const room = await seedRoom('A101');
    await seedTenant('tenant1@test.com', room._id);
    const tenantToken = await loginAs('tenant1@test.com', VALID_PASSWORD);

    // Bill 1 — overdue (2 days ago, within default 5-day grace)
    const res1 = await postBill(ownerToken, room._id, '2024-01', { previousReading: 0, currentReading: 100 });
    await Bill.updateOne({ _id: res1.body.bill._id }, { $set: { dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } });

    // Bill 2 — pending, not yet overdue
    await postBill(ownerToken, room._id, '2024-02', { previousReading: 100, currentReading: 200 });

    const res = await request(app)
      .get('/api/me/bills')
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.bills).toHaveLength(2);
    expect(res.body.totalDue).toBeGreaterThan(0);
    expect(res.body.overdueAmount).toBeGreaterThan(0);
    expect(res.body.overdueAmount).toBeLessThan(res.body.totalDue);
    // overdueAmount must equal exactly the share amount from the overdue bill
    const overdueShareAmount = res1.body.bill.shares[0].amount;
    expect(res.body.overdueAmount).toBe(overdueShareAmount);
  });

  it('should return bills from all rooms the tenant has ever occupied (multi-room history)', async () => {
    // Tenant starts in room A
    const roomA = await seedRoom('A101');
    await seedTenant('tenant1@test.com', roomA._id);
    const tenantToken = await loginAs('tenant1@test.com', VALID_PASSWORD);

    // March bill created while tenant is in room A
    await postBill(ownerToken, roomA._id, '2024-03', { previousReading: 0, currentReading: 100 });

    // Tenant moves to room B
    const roomB = await seedRoom('B101');
    await User.updateOne({ email: 'tenant1@test.com' }, { $set: { roomId: roomB._id } });

    // April bill created while tenant is in room B
    await postBill(ownerToken, roomB._id, '2024-04', { previousReading: 0, currentReading: 100 });

    const res = await request(app)
      .get('/api/me/bills')
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(res.status).toBe(200);
    // Must see both bills — query is on shares.tenantId, not user.roomId
    expect(res.body.bills).toHaveLength(2);
    const months = res.body.bills.map(b => b.billingMonth).sort();
    expect(months).toEqual(['2024-03', '2024-04']);
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/me/bills');
    expect(res.status).toBe(401);
  });
});


// =========================================================================
// SNAPSHOT INTEGRITY
// =========================================================================
describe('Bills Module - snapshot integrity', () => {
  let ownerToken, room;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    room = await seedRoom('A101');
  });

  it('should NOT add a late-joining tenant to an already-created bill', async () => {
    await seedTenant('tenant1@test.com', room._id);
    await seedTenant('tenant2@test.com', room._id);

    const createRes = await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 100 });
    const billId = createRes.body.bill._id;

    // Third tenant joins the room AFTER the bill was created
    await seedTenant('latecomer@test.com', room._id);

    const res = await request(app)
      .get(`/api/admin/bills/${billId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const emails = res.body.bill.shares.map(s => s.tenantEmail);
    expect(emails).toHaveLength(2);
    expect(emails).not.toContain('latecomer@test.com');
  });

  it('should retain a tenant in bill shares after they are removed from the room (roomId set to null)', async () => {
    const tenant = await seedTenant('tenant1@test.com', room._id);

    const createRes = await postBill(ownerToken, room._id, '2024-03', { previousReading: 0, currentReading: 100 });
    const billId = createRes.body.bill._id;

    // Tenant moves out — room assignment cleared
    await User.updateOne({ _id: tenant._id }, { $set: { roomId: null } });

    const res = await request(app)
      .get(`/api/admin/bills/${billId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const share = res.body.bill.shares.find(s => s.tenantEmail === 'tenant1@test.com');
    expect(share).toBeDefined();
    expect(share.tenantEmail).toBe('tenant1@test.com');
    expect(share.tenantName).toBeTruthy();
  });
});

// =========================================================================
// BILL SHARE STATUS STATE MACHINE
// =========================================================================
describe('Bill share status state machine', () => {
  let ownerToken;
  let room;

  beforeEach(async () => {
    await seedOwner();
    ownerToken = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
    room = await seedRoom('SM01');
    await seedTenant('sm-tenant@test.com', room._id);
  });

  it('newly created bill with future dueDate has status=pending', async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const res = await request(app)
      .post('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roomId: room._id, billingMonth: '2030-01', electricity: { previousReading: 0, currentReading: 10 }, dueDate: future });
    expect(res.status).toBe(201);
    res.body.bill.shares.forEach(s => expect(s.status).toBe('pending'));
  });

  it('bill with past dueDate but within grace period has status=overdue after tick (via listBills)', async () => {
    // dueDate 1 day ago, grace=5d → still within grace window → overdue
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await request(app)
      .post('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roomId: room._id, billingMonth: '2030-02', electricity: { previousReading: 0, currentReading: 10 }, dueDate: yesterday, gracePeriodDays: 5 });

    const res = await request(app)
      .get('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const bill = res.body.bills.find(b => b.billingMonth === '2030-02');
    bill.shares.forEach(s => expect(s.status).toBe('overdue'));
  });

  it('bill past grace period has status=arrears after tick', async () => {
    // dueDate 10 days ago, grace=5d → past overdueEnd → arrears
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await request(app)
      .post('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roomId: room._id, billingMonth: '2030-03', electricity: { previousReading: 0, currentReading: 10 }, dueDate: tenDaysAgo, gracePeriodDays: 5 });

    const res = await request(app)
      .get('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const bill = res.body.bills.find(b => b.billingMonth === '2030-03');
    bill.shares.forEach(s => expect(s.status).toBe('arrears'));
  });

  it('paid shares are not modified by tick (terminal state)', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const createRes = await request(app)
      .post('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roomId: room._id, billingMonth: '2030-04', electricity: { previousReading: 0, currentReading: 10 }, dueDate: tenDaysAgo, gracePeriodDays: 5 });
    const billId = createRes.body.bill._id;
    const shareId = createRes.body.bill.shares[0]._id;

    // Manually force status to 'paid' in DB
    await Bill.findOneAndUpdate({ _id: billId, 'shares._id': shareId }, { $set: { 'shares.$.status': 'paid' } });

    const res = await request(app)
      .get('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`);
    const bill = res.body.bills.find(b => b.billingMonth === '2030-04');
    const share = bill.shares.find(s => s._id === shareId);
    expect(share.status).toBe('paid');
  });

  it('settled shares are not modified by tick (terminal state)', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const createRes = await request(app)
      .post('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roomId: room._id, billingMonth: '2030-05', electricity: { previousReading: 0, currentReading: 10 }, dueDate: tenDaysAgo, gracePeriodDays: 5 });
    const billId = createRes.body.bill._id;
    const shareId = createRes.body.bill.shares[0]._id;

    await Bill.findOneAndUpdate({ _id: billId, 'shares._id': shareId }, { $set: { 'shares.$.status': 'settled' } });

    const res = await request(app)
      .get('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`);
    const bill = res.body.bills.find(b => b.billingMonth === '2030-05');
    const share = bill.shares.find(s => s._id === shareId);
    expect(share.status).toBe('settled');
  });

  it('createBill accepts gracePeriodDays override and saves it', async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const res = await request(app)
      .post('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roomId: room._id, billingMonth: '2030-06', electricity: { previousReading: 0, currentReading: 10 }, dueDate: future, gracePeriodDays: 10 });
    expect(res.status).toBe(201);
    expect(res.body.bill.gracePeriodDays).toBe(10);
  });

  it('createBill defaults gracePeriodDays to 5 when not provided', async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const res = await request(app)
      .post('/api/admin/bills')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roomId: room._id, billingMonth: '2030-07', electricity: { previousReading: 0, currentReading: 10 }, dueDate: future });
    expect(res.status).toBe(201);
    expect(res.body.bill.gracePeriodDays).toBe(5);
  });
});

