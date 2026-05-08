const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tenantEmail: { type: String, required: true },
  tenantName: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  paidAt: { type: Date, default: null }
}, { _id: true });

const billSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  roomNameSnapshot: { type: String, required: true },
  billingMonth: { type: String, required: true },
  flatFee: { type: Number, required: true },
  electricity: {
    previousReading: { type: Number, required: true },
    currentReading: { type: Number, required: true },
    ratePerKwh: { type: Number, required: true },
    amount: { type: Number, required: true }
  },
  totalAmount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  shares: [shareSchema]
}, { timestamps: true });

billSchema.index({ roomId: 1, billingMonth: 1 }, { unique: true });

billSchema.pre('validate', async function () {
  const e = this.electricity;
  if (e && typeof e.currentReading === 'number' && typeof e.previousReading === 'number') {
    if (e.currentReading < e.previousReading) {
      this.invalidate('electricity.currentReading', 'currentReading must be >= previousReading');
    }
  }
});

module.exports = mongoose.model('Bill', billSchema);
