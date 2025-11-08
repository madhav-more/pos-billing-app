import {database} from '../db';
import deltaSyncService from './deltaSyncService';

/**
 * Cloud Sync Service using Express Backend
 * Note: This now uses deltaSyncService which connects to your Express backend
 */

/**
 * Sync items to Express backend
 */
export async function syncItemsToCloud() {
  try {
    console.log('Syncing items to Express backend...');
    const result = await deltaSyncService.syncCollection('items');
    return result;
  } catch (error) {
    console.error('Error syncing items:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Sync transactions/sales to Express backend
 */
export async function syncTransactionsToCloud() {
  try {
    console.log('Syncing transactions to Express backend...');
    const result = await deltaSyncService.syncCollection('transactions');
    return result;
  } catch (error) {
    console.error('Error syncing transactions:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Pull items from Express backend
 */
export async function pullItemsFromCloud() {
  try {
    console.log('Pulling items from Express backend...');
    const result = await deltaSyncService.performDeltaSync();
    return result;
  } catch (error) {
    console.error('Error pulling items:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Auto-sync with Express backend on app start
 */
export async function autoSync() {
  try {
    console.log('Starting auto-sync with Express backend...');
    
    // Use deltaSyncService for complete two-way sync
    const result = await deltaSyncService.performDeltaSync();
    
    if (result.success) {
      console.log('Auto-sync completed:', result);
    } else {
      console.log('Auto-sync skipped:', result.message);
    }
  } catch (error) {
    console.error('Auto-sync error:', error);
  }
}
