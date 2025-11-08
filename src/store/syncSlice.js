import {createSlice} from '@reduxjs/toolkit';

const initialState = {
  lastSyncTime: null,
  isSyncing: false,
  syncQueue: [],
  isOnline: true,
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    setLastSyncTime: (state, action) => {
      state.lastSyncTime = action.payload;
    },
    setSyncing: (state, action) => {
      state.isSyncing = action.payload;
    },
    addToSyncQueue: (state, action) => {
      const item = action.payload;
      if (!state.syncQueue.find(q => q.id === item.id && q.type === item.type)) {
        state.syncQueue.push(item);
      }
    },
    removeFromSyncQueue: (state, action) => {
      const {id, type} = action.payload;
      state.syncQueue = state.syncQueue.filter(
        q => !(q.id === id && q.type === type)
      );
    },
    clearSyncQueue: state => {
      state.syncQueue = [];
    },
    setOnlineStatus: (state, action) => {
      state.isOnline = action.payload;
    },
  },
});

export const {
  setLastSyncTime,
  setSyncing,
  addToSyncQueue,
  removeFromSyncQueue,
  clearSyncQueue,
  setOnlineStatus,
} = syncSlice.actions;

export default syncSlice.reducer;
