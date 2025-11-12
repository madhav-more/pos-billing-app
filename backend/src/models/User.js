import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password_hash: {
    type: String,
    required: true
  },
  company: String,
  location: String,
  company_code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ company_code: 1 });

export default mongoose.model('User', userSchema);
