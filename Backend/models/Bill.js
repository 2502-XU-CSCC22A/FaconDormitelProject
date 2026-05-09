const mongoose = require('mongoose');

// Embedded sub-document: one entry per tenant on the bill
const tenantSplitSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    shareAmount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue'],
      default: 'pending'
    },
    paidAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true
    },
    // Billing period stored as "YYYY-MM" e.g. "2025-05"
    period: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format']
    },
    dueDate: {
      type: Date,
      required: true
    },
    utilities: {
      electricity: { type: Number, default: 0, min: 0 },
      water:       { type: Number, default: 0, min: 0 },
      internet:    { type: Number, default: 0, min: 0 }
    },
    // Total of all utilities for the whole room
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    // Number of tenants at the time the bill was created (for audit trail)
    tenantCount: {
      type: Number,
      required: true,
      min: 1
    },
    // One split record per tenant
    tenantSplits: [tenantSplitSchema],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

// One bill per room per period — prevents duplicate postings
billSchema.index({ room: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('Bill', billSchema);
