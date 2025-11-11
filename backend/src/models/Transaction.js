import mongoose from 'mongoose';

const transactionLineSchema = new mongoose.Schema({
  _id: String,
  item_id: String,
  item_name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  },
  unit_price: {
    type: Number,
    default: 0
  },
  per_line_discount: {
    type: Number,
    default: 0
  },
  line_total: {
    type: Number,
    default: 0
  }
}, { _id: false });

const transactionSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  user_id: {
    type: String,
    required: true
  },
  customer_id: {
    type: String,
    ref: 'Customer'
  },
  date: {
    type: Date,
    default: Date.now
  },
  subtotal: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  other_charges: {
    type: Number,
    default: 0
  },
  grand_total: {
    type: Number,
    default: 0
  },
  item_count: {
    type: Number,
    default: 0
  },
  unit_count: {
    type: Number,
    default: 0
  },
  payment_type: {
    type: String,
    enum: ['cash', 'card', 'upi', 'online', 'credit'],
    default: 'cash'
  },
  status: {
    type: String,
    enum: ['draft', 'completed', 'saved_for_later'],
    default: 'completed'
  },
  receipt_path: String,
  lines: [transactionLineSchema]
}, {
  timestamps: true,
  _id: false
});

transactionSchema.index({ user_id: 1 });
transactionSchema.index({ customer_id: 1 });
transactionSchema.index({ date: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ payment_type: 1 });
transactionSchema.index({ updatedAt: 1 });

export default mongoose.model('Transaction', transactionSchema);
