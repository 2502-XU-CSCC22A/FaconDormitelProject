const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  tenantId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  shareId:        { type: mongoose.Schema.Types.ObjectId, required: true },
  billId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', required: true },
  ownerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:         { type: Number, required: true, min: 0.01 },
  paymentDate:    { type: Date, required: true },
  proofImagePath: { type: String, required: true },
  status: {
    type: String,
    enum: ['submitted', 'approved', 'rejected', 'voided'],
    default: 'submitted'
  },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt:  { type: Date },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectReason: { type: String },
  voidedAt:    { type: Date },
  voidedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  voidReason:  { type: String }
}, { timestamps: true });

paymentSchema.index({ tenantId: 1, status: 1 });
paymentSchema.index({ ownerId: 1, status: 1 });
paymentSchema.index({ shareId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
