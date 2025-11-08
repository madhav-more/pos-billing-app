import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import authService from './authService';
import NetInfo from '@react-native-community/netinfo';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * Delta Sync Service with Conflict Resolution
 * Implements two-way sync with client-generated UUIDs and idempotency
 */
class DeltaSyncService {
  constructor() {
    this.isOnline = false;
    this.syncInProgress = false;
    this.lastSyncTime = null;
    this.init();
  }

  async init() {
    // Monitor network status
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected && state.isInternetReachable;
      console.log('Network status:', this.isOnline ? 'Online' : 'Offline');
      
      // Auto-sync when coming online
      if (this.isOnline && !this.syncInProgress) {
        this.performDeltaSync();
      }
    });

    // Load last sync time
    try {
      const lastSync = await database.adapter.getLocal('last_sync_time');
      this.lastSyncTime = lastSync ? new Date(lastSync) : null;
    } catch (error) {
      console.error('Error loading last sync time:', error);
    }
  }

  /**
   * Perform two-way delta sync
   */
  async performDeltaSync() {
    if (this.syncInProgress || !this.isOnline || !authService.isAuthenticated()) {
      return { success: false, message: 'Sync conditions not met' };
    }

    this.syncInProgress = true;
    console.log('🔄 Starting delta sync...');

    try {
      // 1. Push local changes to server
      const pushResult = await this.pushLocalChanges();
      if (!pushResult.success) {
        console.error('Push failed:', pushResult.error);
      }

      // 2. Pull server changes to local
      const pullResult = await this.pullServerChanges();
      if (!pullResult.success) {
        console.error('Pull failed:', pullResult.error);
      }

      // 3. Update last sync time
      this.lastSyncTime = new Date();
      await database.adapter.setLocal('last_sync_time', this.lastSyncTime.toISOString());

      console.log('✅ Delta sync completed');
      return { 
        success: true, 
        pushed: pushResult.count || 0, 
        pulled: pullResult.count || 0 
      };

    } catch (error) {
      console.error('Delta sync error:', error);
      return { success: false, error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Push local changes to server
   */
  async pushLocalChanges() {
    try {
      const collections = ['items', 'customers', 'transactions'];
      let totalPushed = 0;

      for (const collectionName of collections) {
        const collection = database?.collections?.get(collectionName);
        
        if (!collection) {
          console.warn(`Collection ${collectionName} not found, skipping`);
          continue;
        }
        
        // Get unsynced records (is_synced = false or null)
        let unsyncedRecords = [];
        try {
          // Query for records where is_synced is false or doesn't exist
          const allRecords = await collection.query().fetch();
          unsyncedRecords = allRecords.filter(record => {
            // Check if is_synced is false or undefined/null
            return record.isSynced === false || record.isSynced === null || record.isSynced === undefined;
          });
        } catch (queryError) {
          console.warn(`Query error for ${collectionName}:`, queryError.message);
          // Fallback: get all records if query fails
          unsyncedRecords = await collection.query().fetch();
        }

        if (unsyncedRecords.length === 0) continue;

        console.log(`📤 Pushing ${unsyncedRecords.length} ${collectionName}...`);

        // Transform records for API
        const recordsData = unsyncedRecords.map(record => ({
          id: record.id,
          ...record._raw,
          updated_at: record.updatedAt || record.createdAt,
        }));

        // Push to server
        const result = await this.pushCollection(collectionName, recordsData);
        if (result.success) {
          // Mark as synced
          await database.write(async () => {
            for (const record of unsyncedRecords) {
              await record.update(r => {
                r.isSynced = true;
                r.syncedAt = new Date().toISOString();
              });
            }
          });
          totalPushed += recordsData.length;
        }
      }

      return { success: true, count: totalPushed };
    } catch (error) {
      console.error('Push local changes error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Push collection data to server
   */
  async pushCollection(collectionName, records) {
    try {
      if (!this.isOnline) {
        return { success: false, error: 'Device is offline' };
      }
      
      const endpoint = this.getCollectionEndpoint(collectionName);
      const response = await authService.authenticatedRequest(`${API_BASE_URL}${endpoint}/batch`, {
        method: 'POST',
        body: JSON.stringify({ [collectionName]: records }),
      });

      if (!response.success) {
        console.warn(`Push ${collectionName} failed:`, response.error);
        return { success: false, error: response.error };
      }

      const data = await response.response.json();
      return { success: true, data };
    } catch (error) {
      console.error(`Push ${collectionName} error:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pull server changes to local
   */
  async pullServerChanges() {
    try {
      const collections = ['items', 'customers', 'transactions'];
      let totalPulled = 0;

      for (const collectionName of collections) {
        const result = await this.pullCollection(collectionName);
        if (result.success) {
          totalPulled += result.count || 0;
        }
      }

      return { success: true, count: totalPulled };
    } catch (error) {
      console.error('Pull server changes error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pull collection data from server
   */
  async pullCollection(collectionName) {
    try {
      if (!this.isOnline) {
        return { success: false, error: 'Device is offline' };
      }
      
      const endpoint = this.getCollectionEndpoint(collectionName);
      const url = `${API_BASE_URL}${endpoint}?since=${this.lastSyncTime?.toISOString() || ''}`;
      
      const response = await authService.authenticatedRequest(url);
      if (!response.success) {
        console.warn(`Pull ${collectionName} failed:`, response.error);
        return { success: false, error: response.error };
      }

      const data = await response.response.json();
      const records = data[collectionName] || [];

      if (records.length === 0) {
        return { success: true, count: 0 };
      }

      console.log(`📥 Pulling ${records.length} ${collectionName}...`);

      // Merge records with conflict resolution
      await this.mergeRecords(collectionName, records);

      return { success: true, count: records.length };
    } catch (error) {
      console.error(`Pull ${collectionName} error:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Merge server records with local records (conflict resolution)
   */
  async mergeRecords(collectionName, serverRecords) {
    const collection = database?.collections?.get(collectionName);
    
    if (!collection) {
      console.warn(`Collection ${collectionName} not found`);
      return;
    }

    await database.write(async () => {
      for (const serverRecord of serverRecords) {
        try {
          // Try to find existing record
          const existingRecord = await collection.find(serverRecord.id);
          
          // Conflict resolution: server wins if server.updated_at > local.updated_at
          const serverUpdated = new Date(serverRecord.updated_at);
          const localUpdated = new Date(existingRecord.updatedAt || existingRecord.createdAt);
          
          if (serverUpdated > localUpdated) {
            // Server version is newer, update local
            await existingRecord.update(record => {
              Object.keys(serverRecord).forEach(key => {
                if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
                  record[key] = serverRecord[key];
                }
              });
              record.is_synced = true;
              record.synced_at = new Date().toISOString();
            });
          }
        } catch (notFoundError) {
          // Record doesn't exist locally, create it
          await collection.create(record => {
            record._raw.id = serverRecord.id;
            Object.keys(serverRecord).forEach(key => {
              if (key !== 'id') {
                record[key] = serverRecord[key];
              }
            });
            record.is_synced = true;
            record.synced_at = new Date().toISOString();
          });
        }
      }
    });
  }

  /**
   * Get API endpoint for collection
   */
  getCollectionEndpoint(collectionName) {
    const endpoints = {
      items: '/items',
      customers: '/customers',
      transactions: '/transactions',
    };
    return endpoints[collectionName] || `/${collectionName}`;
  }

  /**
   * Force sync specific collection
   */
  async syncCollection(collectionName) {
    if (this.syncInProgress) {
      return { success: false, message: 'Sync already in progress' };
    }

    this.syncInProgress = true;

    try {
      // Push local changes for this collection
      const collection = database?.collections?.get(collectionName);
      
      if (!collection) {
        console.warn(`Collection ${collectionName} not found`);
        return { success: false, error: 'Collection not found' };
      }
      
      const unsyncedRecords = await collection
        .query(Q.where('is_synced', false))
        .fetch();

      if (unsyncedRecords.length > 0) {
        const recordsData = unsyncedRecords.map(record => ({
          id: record.id,
          ...record._raw,
          updated_at: record.updatedAt || record.createdAt,
        }));

        const pushResult = await this.pushCollection(collectionName, recordsData);
        if (pushResult.success) {
          await database.write(async () => {
            for (const record of unsyncedRecords) {
              await record.update(r => {
                r.is_synced = true;
                r.synced_at = new Date().toISOString();
              });
            }
          });
        }
      }

      // Pull server changes for this collection
      const pullResult = await this.pullCollection(collectionName);

      return { 
        success: true, 
        pushed: unsyncedRecords.length, 
        pulled: pullResult.count || 0 
      };
    } catch (error) {
      console.error(`Sync ${collectionName} error:`, error);
      return { success: false, error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      isAuthenticated: authService.isAuthenticated(),
    };
  }

  /**
   * Start auto-sync with interval
   */
  startAutoSync(intervalMs = 30000) {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }

    this.autoSyncInterval = setInterval(() => {
      if (this.isOnline && !this.syncInProgress && authService.isAuthenticated()) {
        this.performDeltaSync();
      }
    }, intervalMs);

    console.log(`🔄 Auto-sync started (${intervalMs}ms interval)`);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
      console.log('⏹️ Auto-sync stopped');
    }
  }
}

// Export singleton instance
export default new DeltaSyncService();
