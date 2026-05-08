const Bill = require('../models/Bill');
const User = require('../models/User');
const Room = require('../models/Room');
const {
  DEFAULT_FLAT_FEE,
  DEFAULT_ELECTRICITY_RATE,
  DEFAULT_DUE_DAYS_FROM_CREATION
} = require('../config/billing');

const BILLING_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// --- HELPERS ---

function addOverdueFlag(bill, now) {
  const isPastDue = bill.dueDate < now;
  const shares = bill.shares.map((s) => {
    const obj = s.toObject ? s.toObject() : { ...s };
    obj.overdue = s.status === 'pending' && isPastDue;
    return obj;
  });
  const result = bill.toObject ? bill.toObject() : { ...bill };
  result.shares = shares;
  return result;
}

// --- 1. CREATE BILL (owner only) ---
const createBill = async (req, res) => {
  try {
    const { roomId, billingMonth, electricity } = req.body;
    const ownerId = req.user.userId;

    if (!roomId || !billingMonth || !electricity) {
      return res.status(400).json({ message: 'roomId, billingMonth, and electricity are required' });
    }

    if (!BILLING_MONTH_RE.test(billingMonth)) {
      return res.status(400).json({ message: 'billingMonth must be in YYYY-MM format' });
    }

    const { currentReading } = electricity;
    if (currentReading === undefined || currentReading === null) {
      return res.status(400).json({ message: 'electricity.currentReading is required' });
    }

    // Auto-fill previousReading from the most recent prior bill for this room
    let { previousReading } = electricity;
    if (previousReading === undefined || previousReading === null) {
      const prior = await Bill.findOne({ roomId }).sort({ billingMonth: -1 }).select('electricity.currentReading');
      previousReading = prior ? prior.electricity.currentReading : 0;
    }

    if (currentReading < previousReading) {
      return res.status(400).json({ message: 'electricity.currentReading must be >= previousReading' });
    }

    const existing = await Bill.findOne({ roomId, billingMonth });
    if (existing) {
      return res.status(409).json({ message: 'A bill already exists for this room and billing month' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    const roomNameSnapshot = room.name || room.roomNumber || roomId.toString();

    const occupants = await User.find({ roomId });
    if (occupants.length === 0) {
      return res.status(400).json({ message: 'Cannot bill a room with no occupants' });
    }

    const flatFee = DEFAULT_FLAT_FEE;
    const ratePerKwh = DEFAULT_ELECTRICITY_RATE;
    const electricityAmount = (currentReading - previousReading) * ratePerKwh;
    const totalAmount = flatFee + electricityAmount;
    const shareAmount = totalAmount / occupants.length;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + DEFAULT_DUE_DAYS_FROM_CREATION);

    const shares = occupants.map((t) => ({
      tenantId: t._id,
      tenantEmail: t.email,
      tenantName: t.name || t.email,
      amount: shareAmount,
      status: 'pending'
    }));

    const bill = new Bill({
      ownerId,
      roomId,
      roomNameSnapshot,
      billingMonth,
      flatFee,
      electricity: { previousReading, currentReading, ratePerKwh, amount: electricityAmount },
      totalAmount,
      dueDate,
      shares
    });

    await bill.save();

    return res.status(201).json({ bill });
  } catch (error) {
    console.error('Create bill error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A bill already exists for this room and billing month' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error during bill creation' });
  }
};

// --- 2. LIST BILLS (owner only, owner-scoped) ---
const listBills = async (req, res) => {
  try {
    const bills = await Bill.find({ ownerId: req.user.userId }).sort({ billingMonth: -1 });
    const now = new Date();
    return res.status(200).json({ bills: bills.map((b) => addOverdueFlag(b, now)) });
  } catch (error) {
    console.error('List bills error:', error);
    return res.status(500).json({ message: 'Server error while fetching bills' });
  }
};

// --- 3. GET BILL (owner only, owner-scoped) ---
const getBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, ownerId: req.user.userId });
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    return res.status(200).json({ bill: addOverdueFlag(bill, new Date()) });
  } catch (error) {
    console.error('Get bill error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Bill not found' });
    }
    return res.status(500).json({ message: 'Server error while fetching bill' });
  }
};

// --- 4. MARK SHARE AS PAID (owner only) ---
const markShareAsPaid = async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.billId, ownerId: req.user.userId });
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const share = bill.shares.id(req.params.shareId);
    if (!share) {
      return res.status(404).json({ message: 'Share not found' });
    }

    if (share.status === 'paid') {
      return res.status(400).json({
        message: 'Share is already marked as paid',
        paidAt: share.paidAt
      });
    }

    share.status = 'paid';
    share.paidAt = new Date();
    await bill.save();

    return res.status(200).json({ bill: addOverdueFlag(bill, new Date()) });
  } catch (error) {
    console.error('Mark share paid error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Bill not found' });
    }
    return res.status(500).json({ message: 'Server error while updating share' });
  }
};

// --- 5. GET MY BILLS (authenticated user, tenant view) ---
const getMyBills = async (req, res) => {
  try {
    const userId = req.user.userId;
    const bills = await Bill.find({ 'shares.tenantId': userId }).sort({ billingMonth: -1 });
    const now = new Date();

    let arrears = 0;
    let totalDue = 0;

    const billsWithFlags = bills.map((b) => {
      const isPastDue = b.dueDate < now;
      const shares = b.shares.map((s) => {
        const obj = s.toObject();
        const isMyShare = s.tenantId && s.tenantId.toString() === userId.toString();
        obj.overdue = s.status === 'pending' && isPastDue;
        if (isMyShare && s.status === 'pending') {
          totalDue += s.amount;
          if (isPastDue) arrears += s.amount;
        }
        return obj;
      });
      const result = b.toObject();
      result.shares = shares;
      return result;
    });

    return res.status(200).json({ bills: billsWithFlags, arrears, totalDue });
  } catch (error) {
    console.error('Get my bills error:', error);
    return res.status(500).json({ message: 'Server error while fetching your bills' });
  }
};

module.exports = { createBill, listBills, getBill, markShareAsPaid, getMyBills };
