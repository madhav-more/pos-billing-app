import {createSlice} from '@reduxjs/toolkit';

const initialState = {
  recentCustomers: [],
  currentCustomer: null,
};

const customerSlice = createSlice({
  name: 'customer',
  initialState,
  reducers: {
    addCustomer: (state, action) => {
      const customer = action.payload;
      // Check if customer already exists
      const existingIndex = state.recentCustomers.findIndex(
        c => c.phone === customer.phone || c.id === customer.id
      );

      if (existingIndex !== -1) {
        // Update existing customer
        state.recentCustomers[existingIndex] = {
          ...state.recentCustomers[existingIndex],
          ...customer,
          lastUsed: new Date().toISOString(),
        };
      } else {
        // Add new customer
        state.recentCustomers.unshift({
          ...customer,
          lastUsed: new Date().toISOString(),
        });
        // Keep only last 50 customers
        if (state.recentCustomers.length > 50) {
          state.recentCustomers.pop();
        }
      }
    },
    setCurrentCustomer: (state, action) => {
      state.currentCustomer = action.payload;
    },
    updateCustomer: (state, action) => {
      const {id, data} = action.payload;
      const index = state.recentCustomers.findIndex(c => c.id === id);
      if (index !== -1) {
        state.recentCustomers[index] = {
          ...state.recentCustomers[index],
          ...data,
        };
      }
      if (state.currentCustomer?.id === id) {
        state.currentCustomer = {
          ...state.currentCustomer,
          ...data,
        };
      }
    },
    clearCurrentCustomer: state => {
      state.currentCustomer = null;
    },
    searchCustomers: (state, action) => {
      const query = action.payload.toLowerCase();
      return state.recentCustomers.filter(
        c =>
          c.name?.toLowerCase().includes(query) ||
          c.phone?.includes(query) ||
          c.email?.toLowerCase().includes(query)
      );
    },
  },
});

export const {
  addCustomer,
  setCurrentCustomer,
  updateCustomer,
  clearCurrentCustomer,
  searchCustomers,
} = customerSlice.actions;

export default customerSlice.reducer;
