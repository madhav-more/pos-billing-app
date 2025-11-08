import {createSlice} from '@reduxjs/toolkit';
import {calculateLineTotal} from '../utils/calculations';

const initialState = {
  items: [],
  taxPercent: 0,
  discount: 0,
  otherCharges: 0,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action) => {
      const {item, quantity = 1} = action.payload;
      const existing = state.items.find(line => line.itemId === item.id);

      if (existing) {
        existing.quantity += quantity;
        existing.lineTotal = calculateLineTotal(
          existing.quantity,
          existing.unitPrice,
          existing.perLineDiscount
        );
      } else {
        state.items.push({
          itemId: item.id,
          itemName: item.name,
          quantity,
          unitPrice: item.price,
          unit: item.unit,
          perLineDiscount: 0,
          lineTotal: calculateLineTotal(quantity, item.price, 0),
        });
      }
    },
    removeItem: (state, action) => {
      state.items = state.items.filter(line => line.itemId !== action.payload);
    },
    updateQuantity: (state, action) => {
      const {itemId, quantity} = action.payload;
      if (quantity <= 0) {
        state.items = state.items.filter(line => line.itemId !== itemId);
      } else {
        const item = state.items.find(line => line.itemId === itemId);
        if (item) {
          item.quantity = quantity;
          item.lineTotal = calculateLineTotal(
            quantity,
            item.unitPrice,
            item.perLineDiscount
          );
        }
      }
    },
    updateLineDiscount: (state, action) => {
      const {itemId, discount} = action.payload;
      const item = state.items.find(line => line.itemId === itemId);
      if (item) {
        item.perLineDiscount = discount;
        item.lineTotal = calculateLineTotal(
          item.quantity,
          item.unitPrice,
          discount
        );
      }
    },
    setTaxPercent: (state, action) => {
      state.taxPercent = action.payload;
    },
    setDiscount: (state, action) => {
      state.discount = action.payload;
    },
    setOtherCharges: (state, action) => {
      state.otherCharges = action.payload;
    },
    clearCart: state => {
      state.items = [];
      state.taxPercent = 0;
      state.discount = 0;
      state.otherCharges = 0;
    },
  },
});

export const {
  addItem,
  removeItem,
  updateQuantity,
  updateLineDiscount,
  setTaxPercent,
  setDiscount,
  setOtherCharges,
  clearCart,
} = cartSlice.actions;

export default cartSlice.reducer;
