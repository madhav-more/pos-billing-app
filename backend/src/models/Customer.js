import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  user_id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  phone: String,
  email: String,
  address: String,
  company_code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  }
}, {
  timestamps: true,
  _id: false // We're using custom _id
});

customerSchema.index({ user_id: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ company_code: 1 });
customerSchema.index({ updatedAt: 1 });

export default mongoose.model('Customer', customerSchema);
