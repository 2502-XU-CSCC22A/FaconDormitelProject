const Bill = require('../models/Bill');
const Room = require('../models/Room');
const User = require('../models/User');

// ── OWNER: Create a bill for a room ─────────────────────────────
// POST /api/admin/bills
// Body: { roomId, period, dueDate, utilities: { electricity, water, internet } }
const createBill = async (req, res) => {
  try {
    const { roomId, period, dueDate, utilities } = req.body;

    if (!roomId || !period || !dueDate || !utilities) {
      return res.status(400).json({
        message: 'roomId, period, dueDate, and utilities are required'
      });
    }

    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ message: 'Period must be in YYYY-MM format (e.g. 2025-05)' });
    }

    const { electricity = 0, water = 0, internet = 0 } = utilities;

    if (electricity < 0 || water < 0 || internet < 0) {
      return res.status(400).json({ message: 'Utility amounts cannot be negative' });
    }

    const totalAmount = electricity + water + internet;
    if (totalAmount <= 0) {
      return res.status(400).json({ message: 'Total utility amount must be greater than 0' });
    }

    // Find the room and its assigned tenants
    const room = await Room.findById(roomId).populate('tenants', 'name email');
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.tenants || room.tenants.length === 0) {
      return res.status(400).json({
        message: 'No tenants assigned to this room. Assign tenants before creating a bill.'
      });
    }

    const tenantCount = room.tenants.length;
    // Round to 2 decimal places to avoid floating point issues
    const shareAmount = parseFloat((totalAmount / tenantCount).toFixed(2));

    // Build one split record per tenant
    const tenantSplits = room.tenants.map((t) => ({
      tenant: t._id,
      shareAmount,
      status: 'pending',
      paidAt: null
    }));

    const bill = new Bill({
      room: roomId,
      period,
      dueDate: new Date(dueDate),
      utilities: { electricity, water, internet },
      totalAmount,
      tenantCount,
      tenantSplits,
      createdBy: req.user.userId
    });

    await bill.save();
    await bill.populate('room', 'roomNumber');

    return res.status(201).json({
      message: 'Bill created successfully',
      bill
    });

  } catch (error) {
    console.error('Create bill error:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'A bill for this period already exists for this room'
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error during bill creation' });
  }
};

// ── OWNER: List all bills ────────────────────────────────────────
// GET /api/admin/bills
const listBills = async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate('room', 'roomNumber')
      .populate('tenantSplits.tenant', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({ bills });
  } catch (error) {
    console.error('List bills error:', error);
    return res.status(500).json({ message: 'Server error while fetching bills' });
  }
};

// ── OWNER: Get a single bill ─────────────────────────────────────
// GET /api/admin/bills/:billId
const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.billId)
      .populate('room', 'roomNumber capacity')
      .populate('tenantSplits.tenant', 'name email')
      .populate('createdBy', 'name email');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    return res.status(200).json({ bill });
  } catch (error) {
    console.error('Get bill error:', error);
    return res.status(500).json({ message: 'Server error while fetching bill' });
  }
};

// ── OWNER: Update a tenant's payment status ──────────────────────
// PATCH /api/admin/bills/:billId/tenants/:tenantId
// Body: { status: 'paid' | 'pending' | 'overdue' }
const updatePaymentStatus = async (req, res) => {
  try {
    const { billId, tenantId } = req.params;
    const { status } = req.body;

    const validStatuses = ['paid', 'pending', 'overdue'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const split = bill.tenantSplits.find(
      (s) => s.tenant.toString() === tenantId
    );
    if (!split) {
      return res.status(404).json({ message: 'Tenant not found in this bill' });
    }

    split.status = status;
    split.paidAt = status === 'paid' ? new Date() : null;

    await bill.save();

    return res.status(200).json({
      message: `Payment marked as ${status}`,
      split: {
        tenant: split.tenant,
        shareAmount: split.shareAmount,
        status: split.status,
        paidAt: split.paidAt
      }
    });

  } catch (error) {
    console.error('Update payment status error:', error);
    return res.status(500).json({ message: 'Server error while updating payment status' });
  }
};

// ── OWNER: Assign a tenant to a room ─────────────────────────────
// POST /api/admin/rooms/:roomId/tenants
// Body: { tenantId }
const assignTenantToRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId is required' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const tenant = await User.findOne({ _id: tenantId, role: 'client' });
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Prevent duplicate assignment
    if (room.tenants.map((id) => id.toString()).includes(tenantId)) {
      return res.status(409).json({ message: 'Tenant is already assigned to this room' });
    }

    // Check capacity
    if (room.tenants.length >= room.capacity) {
      return res.status(400).json({ message: 'Room is at full capacity' });
    }

    room.tenants.push(tenantId);
    room.currentOccupants = room.tenants.length;
    room.status = room.currentOccupants >= room.capacity ? 'full' : 'available';
    await room.save();

    await room.populate('tenants', 'name email');

    return res.status(200).json({
      message: 'Tenant assigned to room successfully',
      room: {
        _id: room._id,
        roomNumber: room.roomNumber,
        capacity: room.capacity,
        currentOccupants: room.currentOccupants,
        status: room.status,
        tenants: room.tenants
      }
    });

  } catch (error) {
    console.error('Assign tenant error:', error);
    return res.status(500).json({ message: 'Server error while assigning tenant' });
  }
};

// ── OWNER: Remove a tenant from a room ───────────────────────────
// DELETE /api/admin/rooms/:roomId/tenants/:tenantId
const removeTenantFromRoom = async (req, res) => {
  try {
    const { roomId, tenantId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const tenantIndex = room.tenants.map((id) => id.toString()).indexOf(tenantId);
    if (tenantIndex === -1) {
      return res.status(404).json({ message: 'Tenant not found in this room' });
    }

    room.tenants.splice(tenantIndex, 1);
    room.currentOccupants = room.tenants.length;
    room.status = room.currentOccupants >= room.capacity ? 'full' : 'available';
    await room.save();

    return res.status(200).json({
      message: 'Tenant removed from room successfully',
      room: {
        _id: room._id,
        roomNumber: room.roomNumber,
        currentOccupants: room.currentOccupants,
        status: room.status
      }
    });

  } catch (error) {
    console.error('Remove tenant error:', error);
    return res.status(500).json({ message: 'Server error while removing tenant' });
  }
};

// ── TENANT: Get all my bills ─────────────────────────────────────
// GET /api/bills/my
const getMyBills = async (req, res) => {
  try {
    const userId = req.user.userId;

    const bills = await Bill.find({ 'tenantSplits.tenant': userId })
      .populate('room', 'roomNumber')
      .sort({ createdAt: -1 });

    // Return only this tenant's split info per bill
    const formatted = bills.map((b) => {
      const mySplit = b.tenantSplits.find(
        (s) => s.tenant.toString() === userId
      );
      return {
        _id: b._id,
        period: b.period,
        dueDate: b.dueDate,
        room: b.room,
        utilities: b.utilities,
        totalAmount: b.totalAmount,
        tenantCount: b.tenantCount,
        shareAmount: mySplit?.shareAmount ?? 0,
        status: mySplit?.status ?? 'pending',
        paidAt: mySplit?.paidAt ?? null,
        createdAt: b.createdAt
      };
    });

    return res.status(200).json({ bills: formatted });
  } catch (error) {
    console.error('Get my bills error:', error);
    return res.status(500).json({ message: 'Server error while fetching your bills' });
  }
};

// ── TENANT: Get single bill detail ──────────────────────────────
// GET /api/bills/my/:billId
const getMyBillById = async (req, res) => {
  try {
    const userId = req.user.userId;

    const bill = await Bill.findById(req.params.billId)
      .populate('room', 'roomNumber capacity')
      .populate('tenantSplits.tenant', 'name email');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Ensure this tenant belongs to this bill
    const mySplit = bill.tenantSplits.find(
      (s) => s.tenant._id.toString() === userId
    );
    if (!mySplit) {
      return res.status(403).json({
        message: 'Access denied. This bill is not assigned to you.'
      });
    }

    return res.status(200).json({
      bill: {
        _id: bill._id,
        period: bill.period,
        dueDate: bill.dueDate,
        room: bill.room,
        utilities: bill.utilities,
        totalAmount: bill.totalAmount,
        tenantCount: bill.tenantCount,
        myShare: {
          shareAmount: mySplit.shareAmount,
          status: mySplit.status,
          paidAt: mySplit.paidAt
        },
        // All roommates' statuses (name shown, no email leak)
        allSplits: bill.tenantSplits.map((s) => ({
          tenant: { _id: s.tenant._id, name: s.tenant.name },
          shareAmount: s.shareAmount,
          status: s.status,
          paidAt: s.paidAt
        })),
        createdAt: bill.createdAt
      }
    });

  } catch (error) {
    console.error('Get my bill error:', error);
    return res.status(500).json({ message: 'Server error while fetching bill' });
  }
};

module.exports = {
  createBill,
  listBills,
  getBillById,
  updatePaymentStatus,
  assignTenantToRoom,
  removeTenantFromRoom,
  getMyBills,
  getMyBillById
};
