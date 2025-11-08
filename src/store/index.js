import {configureStore} from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import cartReducer from './cartSlice';
import customerReducer from './customerSlice';
import syncReducer from './syncSlice';

const persistConfig = {
  key: 'root',
  version: 1,
  storage: AsyncStorage,
  whitelist: ['cart', 'customer', 'sync'], // only persist these reducers
};

const rootReducer = {
  cart: persistReducer({...persistConfig, key: 'cart'}, cartReducer),
  customer: persistReducer({...persistConfig, key: 'customer'}, customerReducer),
  sync: persistReducer({...persistConfig, key: 'sync'}, syncReducer),
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
