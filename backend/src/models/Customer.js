import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  phone: String,
  email: String,
  address: String
}, {
  timestamps: true,
  _id: false // We're using custom _id
});

customerSchema.index({ user_id: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ updatedAt: 1 });

export default mongoose.model('Customer', customerSchema);
