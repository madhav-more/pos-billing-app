import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
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
  barcode: String,
  sku: String,
  price: {
    type: Number,
    default: 0
  },
  unit: {
    type: String,
    default: 'pc'
  },
  image_url: String,
  category: String,
  inventory_qty: {
    type: Number,
    default: 0
  },
  recommended: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  _id: false
});

itemSchema.index({ user_id: 1 });
itemSchema.index({ barcode: 1 });
itemSchema.index({ sku: 1 });
itemSchema.index({ category: 1 });
itemSchema.index({ updatedAt: 1 });

export default mongoose.model('Item', itemSchema);
