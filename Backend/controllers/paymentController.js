const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Payment = require('../models/Payment');
const Bill = require('../models/Bill');
const User = require('../models/User');
const { sendEmail, buildPaymentConfirmationEmail } = require('../services/emailService');
const { DEFAULT_GRACE_PERIOD_DAYS } = require('../config/billing');

// POST /api/me/payments
const submitPayment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Proof image is required' });
    }

    const { shareId, amount, paymentDate } = req.body;

    if (!shareId) {
      return res.status(400).json({ message: 'shareId is required' });
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'amount must be greater than 0' });
    }

    if (!paymentDate) {
      return res.status(400).json({ message: 'paymentDate is required' });
    }
    const parsedDate = new Date(paymentDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'paymentDate is invalid' });
    }
    if (parsedDate > new Date()) {
      return res.status(400).json({ message: 'paymentDate cannot be in the future' });
    }

    // Find bill containing this share
    const bill = await Bill.findOne({ 'shares._id': shareId });
    if (!bill) {
      return res.status(404).json({ message: 'Share not found' });
    }

    const share = bill.shares.id(shareId);
    if (!share) {
      return res.status(404).json({ message: 'Share not found' });
    }

    // Tenant must own this share
    if (!share.tenantId || share.tenantId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: 'Forbidden: this share does not belong to you' });
    }

    // No active payment may already exist for this share
    const existing = await Payment.findOne({
      shareId,
      status: { $in: ['submitted', 'approved'] }
    });
    if (existing) {
      return res.status(409).json({ message: 'An active payment already exists for this share' });
    }

    // Disk storage sets req.file.filename; memory storage (test env) does not
    let proofImagePath;
    if (req.file.filename) {
      proofImagePath = `payment-proofs/${req.file.filename}`;
    } else {
      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
      proofImagePath = `payment-proofs/${uuidv4()}${ext}`;
    }

    const payment = new Payment({
      tenantId: req.user.userId,
      shareId,
      billId: bill._id,
      ownerId: bill.ownerId,
      amount: parsedAmount,
      paymentDate: parsedDate,
      proofImagePath,
      status: 'submitted'
    });

    await payment.save();

    return res.status(201).json({ payment });
  } catch (err) {
    console.error('Submit payment error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Share not found' });
    }
    return res.status(500).json({ message: 'Server error submitting payment' });
  }
};

// GET /api/me/payments
const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ tenantId: req.user.userId })
      .sort({ submittedAt: -1 });
    return res.status(200).json({ payments });
  } catch (err) {
    console.error('Get my payments error:', err);
    return res.status(500).json({ message: 'Server error fetching payments' });
  }
};

// GET /api/admin/payments
const listPayments = async (req, res) => {
  try {
    const filter = { ownerId: req.user.userId };
    if (req.query.status) filter.status = req.query.status;

    const payments = await Payment.find(filter)
      .sort({ submittedAt: -1 })
      .populate('tenantId', 'name email')
      .populate('billId', 'roomNameSnapshot billingMonth');

    return res.status(200).json({ payments });
  } catch (err) {
    console.error('List payments error:', err);
    return res.status(500).json({ message: 'Server error fetching payments' });
  }
};

// GET /api/admin/payments/pending
const getPendingPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ ownerId: req.user.userId, status: 'submitted' })
      .sort({ submittedAt: -1 })
      .populate('tenantId', 'name email')
      .populate('billId', 'roomNameSnapshot billingMonth');

    return res.status(200).json({ payments });
  } catch (err) {
    console.error('Get pending payments error:', err);
    return res.status(500).json({ message: 'Server error fetching pending payments' });
  }
};

// POST /api/admin/payments/:id/approve
const approvePayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, ownerId: req.user.userId });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.status !== 'submitted') {
      return res.status(400).json({ message: 'Payment is not in submitted state' });
    }

    const bill = await Bill.findOne({ _id: payment.billId, ownerId: req.user.userId });
    if (!bill) {
      return res.status(403).json({ message: 'Bill not found or access denied' });
    }

    const share = bill.shares.id(payment.shareId);
    if (!share) {
      return res.status(404).json({ message: 'Share not found on bill' });
    }

    payment.status = 'approved';
    payment.reviewedAt = new Date();
    payment.reviewedBy = req.user.userId;

    const wasArrears = share.status === 'arrears' || share.status === 'unpaid';
    share.status = wasArrears ? 'settled' : 'paid';
    share.paidAt = payment.paymentDate;

    await Promise.all([payment.save(), bill.save()]);

    // Send payment confirmation email (fire-and-forget)
    try {
      const tenant = await User.findById(payment.tenantId).select('name email');
      if (tenant) {
        const { subject, html, text } = buildPaymentConfirmationEmail({
          tenantName: tenant.name || tenant.email,
          roomName: bill.roomNameSnapshot,
          billingMonth: bill.billingMonth,
          amount: payment.amount,
          paymentDate: payment.paymentDate
        });
        sendEmail({ to: tenant.email, subject, html, text }).catch(err =>
          console.error('[approvePayment] confirmation email error:', err)
        );
      }
    } catch (emailErr) {
      console.error('[approvePayment] email lookup error:', emailErr);
    }

    return res.status(200).json({ payment });
  } catch (err) {
    console.error('Approve payment error:', err);
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Payment not found' });
    }
    return res.status(500).json({ message: 'Server error approving payment' });
  }
};

// POST /api/admin/payments/:id/reject
const rejectPayment = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'reason is required' });
    }

    const payment = await Payment.findOne({ _id: req.params.id, ownerId: req.user.userId });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.status !== 'submitted') {
      return res.status(400).json({ message: 'Payment is not in submitted state' });
    }

    payment.status = 'rejected';
    payment.reviewedAt = new Date();
    payment.reviewedBy = req.user.userId;
    payment.rejectReason = reason.trim();

    await payment.save();

    let emailSent = false;
    try {
      const [tenant, bill] = await Promise.all([
        User.findById(payment.tenantId).select('name email'),
        Bill.findById(payment.billId).select('roomNameSnapshot billingMonth')
      ]);

      if (tenant && bill) {
        const result = await sendEmail({
          to: tenant.email,
          subject: 'Payment submission rejected — Rfacon Dormitel',
          html: `<p>Hi ${tenant.name},</p>
                 <p>Your payment submission for ${bill.roomNameSnapshot}
                 (${bill.billingMonth}) was rejected.</p>
                 <p><strong>Reason:</strong> ${reason}</p>
                 <p>Please re-submit with corrected information.</p>`,
          text: `Hi ${tenant.name},\n\nYour payment submission for ${bill.roomNameSnapshot} (${bill.billingMonth}) was rejected.\n\nReason: ${reason}\n\nPlease re-submit with corrected information.\n\n— Rfacon Dormitel`
        });
        emailSent = result.success === true;
      }
    } catch (emailErr) {
      console.error('Rejection email error:', emailErr);
    }

    return res.status(200).json({ payment, emailSent });
  } catch (err) {
    console.error('Reject payment error:', err);
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Payment not found' });
    }
    return res.status(500).json({ message: 'Server error rejecting payment' });
  }
};

// POST /api/admin/payments/:id/void
const voidPayment = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'reason is required' });
    }

    const payment = await Payment.findOne({ _id: req.params.id, ownerId: req.user.userId });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.status !== 'approved') {
      return res.status(400).json({ message: 'Payment is not in approved state' });
    }

    const bill = await Bill.findOne({ _id: payment.billId, ownerId: req.user.userId });
    if (!bill) {
      return res.status(403).json({ message: 'Bill not found or access denied' });
    }

    const share = bill.shares.id(payment.shareId);
    if (!share) {
      return res.status(404).json({ message: 'Share not found on bill' });
    }

    payment.status = 'voided';
    payment.voidedAt = new Date();
    payment.voidedBy = req.user.userId;
    payment.voidReason = reason.trim();

    const grace = bill.gracePeriodDays ?? DEFAULT_GRACE_PERIOD_DAYS;
    const now = Date.now();
    const dueMs = new Date(bill.dueDate).getTime();
    const overdueEndMs = dueMs + (grace * 24 * 60 * 60 * 1000);
    if (now < dueMs) share.status = 'pending';
    else if (now < overdueEndMs) share.status = 'overdue';
    else share.status = 'arrears';
    share.paidAt = null;

    await Promise.all([payment.save(), bill.save()]);

    return res.status(200).json({ payment });
  } catch (err) {
    console.error('Void payment error:', err);
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Payment not found' });
    }
    return res.status(500).json({ message: 'Server error voiding payment' });
  }
};

module.exports = {
  submitPayment,
  getMyPayments,
  listPayments,
  getPendingPayments,
  approvePayment,
  rejectPayment,
  voidPayment
};
