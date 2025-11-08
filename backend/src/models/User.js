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
  location: String
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ email: 1 });

export default mongoose.model('User', userSchema);
