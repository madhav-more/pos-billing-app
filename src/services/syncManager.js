import {AppState} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import deltaSyncService from './deltaSyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Sync Manager
 * Handles automatic synchronization triggers based on:
 * - App focus/resume
 * - Network status changes (offline -> online)
 * - Manual pull-to-refresh
 */
class SyncManager {
  constructor() {
    this.appStateSubscription = null;
    this.netInfoSubscription = null;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.isOnline = true;
    this.minSyncInterval = 3600000; // 1 hour (3600000ms) minimum between syncs
  }

  /**
   * Initialize sync manager with listeners
   */
  async initialize() {
    try {
      // Load last sync time from storage
      const lastSync = await AsyncStorage.getItem('last_sync_time');
      if (lastSync) {
        this.lastSyncTime = new Date(lastSync);
      }

      // Set up AppState listener for app focus/resume
      this.appStateSubscription = AppState.addEventListener(
        'change',
        this.handleAppStateChange
      );

      // Set up NetInfo listener for network changes
      this.netInfoSubscription = NetInfo.addEventListener(
        this.handleNetworkChange
      );

      console.log('✅ Sync Manager initialized (offline-first mode)');
    } catch (error) {
      console.warn('Sync Manager initialization warning:', error.message);
    }
  }

  /**
   * Clean up listeners
   */
  cleanup() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    if (this.netInfoSubscription) {
      this.netInfoSubscription();
    }
  }

  /**
   * Handle app state changes (background <-> foreground)
   */
  handleAppStateChange = async nextAppState => {
    if (nextAppState === 'active') {
      console.log('📱 App resumed - checking for sync');
      await this.triggerSync('app_resume');
    }
  };

  /**
   * Handle network status changes
   */
  handleNetworkChange = async state => {
    const wasOffline = !this.isOnline;
    this.isOnline = state.isConnected && state.isInternetReachable;

    // Trigger sync when coming back online
    if (wasOffline && this.isOnline) {
      console.log('🌐 Network restored - triggering sync');
      await this.triggerSync('network_restored');
    }
  };

  /**
   * Trigger sync if conditions are met
   */
  async triggerSync(reason = 'manual') {
    // Check if already syncing
    if (this.isSyncing) {
      return {success: false, message: 'Sync in progress'};
    }

    // Check if we're online
    if (!this.isOnline) {
      return {success: false, message: 'Device is offline'};
    }

    // Check minimum sync interval
    if (this.lastSyncTime) {
      const timeSinceLastSync = Date.now() - this.lastSyncTime.getTime();
      if (timeSinceLastSync < this.minSyncInterval && reason !== 'manual') {
        console.log('⏱️ Too soon since last sync, skipping');
        return {success: false, message: 'Too soon since last sync'};
      }
    }

    // Perform sync
    return await this.performSync(reason);
  }

  /**
   * Perform the actual sync operation
   */
  async performSync(reason) {
    this.isSyncing = true;
    console.log(`🔄 Starting sync (reason: ${reason})`);

    try {
      // Sync all collections in sequence
      const collections = ['items', 'transactions', 'customers'];
      const results = {};

      for (const collection of collections) {
        try {
          const result = await deltaSyncService.syncCollection(collection);
          results[collection] = result;
        } catch (error) {
          console.warn(`Sync ${collection} skipped:`, error.message);
          results[collection] = {success: false, error: error.message};
        }
      }

      // Update last sync time
      this.lastSyncTime = new Date();
      await AsyncStorage.setItem(
        'last_sync_time',
        this.lastSyncTime.toISOString()
      );

      console.log('✅ Sync completed successfully');
      return {
        success: true,
        message: 'Sync completed',
        results,
        syncTime: this.lastSyncTime,
      };
    } catch (error) {
      console.error('Sync error:', error);
      return {
        success: false,
        message: 'Sync failed',
        error: error.message,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Manual sync trigger (e.g., pull-to-refresh)
   */
  async manualSync() {
    console.log('👆 Manual sync triggered');
    return await this.triggerSync('manual');
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      isOnline: this.isOnline,
    };
  }

  /**
   * Force sync (bypasses interval check)
   */
  async forceSync() {
    this.lastSyncTime = null; // Reset to force sync
    return await this.triggerSync('force');
  }
}

// Export singleton instance
export default new SyncManager();
