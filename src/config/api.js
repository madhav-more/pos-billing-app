// API Configuration
// Use your computer's IP address instead of localhost for Expo Go
// Change this if your IP address changes
export const API_CONFIG = {
  BASE_URL: 'http://10.108.114.252:3000/api',
  TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  REGISTER: '/auth/register',
  LOGIN: '/auth/login',
  VERIFY: '/auth/verify',
  
  // Sync
  SYNC_PUSH: '/sync/push',
  SYNC_PULL: '/sync/pull',
  
  // Items
  ITEMS: '/items',
  ITEMS_BULK: '/items/bulk',
  
  // Customers
  CUSTOMERS: '/customers',
  CUSTOMERS_BULK: '/customers/bulk',
  
  // Transactions
  TRANSACTIONS: '/transactions',
  TRANSACTIONS_BULK: '/transactions/bulk',
  
  // Vouchers
  VOUCHER_GENERATE: '/vouchers/generate',
  
  // Reports
  REPORTS: '/reports',
  REPORTS_SUMMARY: '/reports/summary',
  
  // Health
  PING: '/ping',
};

export default {
  API_CONFIG,
  API_ENDPOINTS,
};
