import {generateUUID} from '../utils/uuid';
import NetInfo from '@react-native-community/netinfo';
import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import simpleAuthService from './simpleAuthService';
import {API_CONFIG, API_ENDPOINTS} from '../config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;

class ComprehensiveSyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncProgress = { current: 0, total: 0 };
    this.syncErrors = [];
  }

  async canSync() {
    const netInfo = await NetInfo.fetch();
    const isOnline = netInfo.isConnected && netInfo.isInternetReachable;
    const isAuthenticated = simpleAuthService.isAuthenticated();
    return isOnline && isAuthenticated;
  }

  generateIdempotencyKey(entityType, entityId) {
    return `${entityType}-${entityId}-${Date.now()}`;
  }

  async getUnsyncedData() {
    try {
      const currentUser = simpleAuthService.getCurrentUser();
      const currentUserId = currentUser?.id || null;
      
      const itemsCollection = database.collections.get('items');
      const customersCollection = database.collections.get('customers');
      const transactionsCollection = database.collections.get('transactions');
      const transactionLinesCollection = database.collections.get('transaction_lines');

      const unsyncedItems = await itemsCollection.query(
        Q.where('is_synced', false)
      ).fetch();

      const unsyncedCustomers = await customersCollection.query(
        Q.where('is_synced', false)
      ).fetch();

      const unsyncedTransactions = await transactionsCollection.query(
        Q.where('is_synced', false)
      ).fetch();

      const unsyncedLines = await transactionLinesCollection.query().fetch();

      return {
        items: unsyncedItems.map(item => ({
          _id: item.id, // MongoDB expects _id
          local_id: item.localId,
          user_id: item.userId || currentUserId, // Use current user if item doesn't have userId
          name: item.name,
          barcode: item.barcode,
          sku: item.sku,
          price: item.price,
          unit: item.unit,
          category: item.category,
          inventory_qty: item.inventoryQty,
          recommended: item.recommended,
          updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
          createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        })),
        customers: unsyncedCustomers.map(customer => ({
          _id: customer.id, // MongoDB expects _id
          local_id: customer.localId,
          user_id: customer.userId || currentUserId, // Use current user if customer doesn't have userId
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          updatedAt: customer.updatedAt ? new Date(customer.updatedAt).toISOString() : new Date().toISOString(),
          createdAt: customer.createdAt ? new Date(customer.createdAt).toISOString() : new Date().toISOString(),
        })),
        transactions: unsyncedTransactions.map(tx => ({
          _id: tx.id, // MongoDB expects _id
          local_id: tx.localId,
          user_id: tx.userId || currentUserId, // Use current user if transaction doesn't have userId
          customer_id: tx.customerId,
          customer_name: tx.customerName,
          customer_mobile: tx.customerMobile,
          date: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString(),
          subtotal: tx.subtotal,
          tax: tx.tax,
          discount: tx.discount,
          other_charges: tx.otherCharges,
          grand_total: tx.grandTotal,
          item_count: tx.itemCount,
          unit_count: tx.unitCount,
          payment_type: tx.paymentType,
          status: tx.status,
          updatedAt: tx.updatedAt ? new Date(tx.updatedAt).toISOString() : new Date().toISOString(),
          createdAt: tx.createdAt ? new Date(tx.createdAt).toISOString() : new Date().toISOString(),
        })),
      };
    } catch (error) {
      console.error('Error getting unsynced data:', error);
      return { items: [], customers: [], transactions: [] };
    }
  }

  async pushLocalChanges(userId) {
    try {
      const unsyncedData = await this.getUnsyncedData();
      const totalItems = unsyncedData.items.length + unsyncedData.customers.length + unsyncedData.transactions.length;

      console.log(`📤 Push: ${totalItems} items to sync (Items: ${unsyncedData.items.length}, Customers: ${unsyncedData.customers.length}, Transactions: ${unsyncedData.transactions.length})`);

      if (totalItems === 0) {
        console.log('✅ No items to sync');
        return { success: true, synced: 0, conflicts: [] };
      }

      this.syncProgress = { current: 0, total: totalItems };

      const currentUser = simpleAuthService.getCurrentUser();
      console.log(`🔐 User ID for sync: ${currentUser?.id}`);
      
      const url = `${API_BASE_URL}${API_ENDPOINTS.SYNC_PUSH}`;
      console.log(`🌐 Sync URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id, // Send user ID in header
        },
        body: JSON.stringify({
          items: unsyncedData.items,
          customers: unsyncedData.customers,
          transactions: unsyncedData.transactions,
          user_id: userId,
        }),
      });

      console.log(`📊 Response status: ${response.status} ${response.statusText}`);
      
      const result = await response.json();
      console.log('📊 Sync result:', JSON.stringify(result, null, 2));

      if (response.ok) {
        console.log('✅ Push successful, marking items as synced');
        await this.markSyncedItems(result);
        
        this.syncProgress.current = totalItems;

        return {
          success: true,
          synced: (result.items?.synced?.length || 0) + 
                  (result.customers?.synced?.length || 0) + 
                  (result.transactions?.synced?.length || 0),
          conflicts: [
            ...(result.items?.conflicts || []),
            ...(result.customers?.conflicts || []),
            ...(result.transactions?.conflicts || [])
          ]
        };
      } else {
        return { success: false, error: result.error || 'Push failed' };
      }
    } catch (error) {
      console.error('Push changes error:', error);
      this.syncErrors.push({ type: 'push', error: error.message });
      return { success: false, error: error.message };
    }
  }

  async markSyncedItems(result) {
    try {
      await database.write(async () => {
        const itemsCollection = database.collections.get('items');
        const customersCollection = database.collections.get('customers');
        const transactionsCollection = database.collections.get('transactions');

        if (result.items?.synced) {
          for (const syncedItem of result.items.synced) {
            const items = await itemsCollection.query(
              Q.where('local_id', syncedItem.id)
            ).fetch();
            
            if (items.length > 0) {
              await items[0].update(item => {
                item.is_synced = true;
                item.cloud_id = syncedItem.cloud_id || syncedItem.id;
                item.synced_at = new Date().toISOString();
                item.sync_status = 'synced';
              });
            }
          }
        }

        if (result.customers?.synced) {
          for (const syncedCustomer of result.customers.synced) {
            const customers = await customersCollection.query(
              Q.where('local_id', syncedCustomer.id)
            ).fetch();
            
            if (customers.length > 0) {
              await customers[0].update(customer => {
                customer.is_synced = true;
                customer.cloud_id = syncedCustomer.cloud_id || syncedCustomer.id;
                customer.synced_at = new Date().toISOString();
                customer.sync_status = 'synced';
              });
            }
          }
        }

        if (result.transactions?.synced) {
          for (const syncedTx of result.transactions.synced) {
            const transactions = await transactionsCollection.query(
              Q.where('local_id', syncedTx.id)
            ).fetch();
            
            if (transactions.length > 0) {
              await transactions[0].update(tx => {
                tx.is_synced = true;
                tx.cloud_id = syncedTx.cloud_id || syncedTx.id;
                tx.synced_at = new Date().toISOString();
                tx.sync_status = 'synced';
                if (syncedTx.voucher_number) {
                  tx.voucher_number = syncedTx.voucher_number;
                  tx.provisional_voucher = null;
                }
              });
            }
          }
        }
      });

      console.log('✅ Synced items marked in local DB');
    } catch (error) {
      console.error('Error marking synced items:', error);
    }
  }

  async pullServerChanges(userId) {
    try {
      const lastSyncTime = this.lastSyncTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const currentUser = simpleAuthService.getCurrentUser();

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.SYNC_PULL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id,
        },
        body: JSON.stringify({
          since: lastSyncTime,
          user_id: userId,
        }),
      });

      const serverData = await response.json();

      if (response.ok) {
        const appliedCount = await this.applyServerChanges(serverData);
        return {
          success: true,
          synced: appliedCount,
          conflicts: []
        };
      } else {
        return { success: false, error: serverData.error || 'Pull failed' };
      }
    } catch (error) {
      console.error('Pull changes error:', error);
      this.syncErrors.push({ type: 'pull', error: error.message });
      return { success: false, error: error.message };
    }
  }

  async applyServerChanges(serverData) {
    let appliedCount = 0;

    try {
      await database.write(async () => {
        const itemsCollection = database.collections.get('items');
        const customersCollection = database.collections.get('customers');
        const transactionsCollection = database.collections.get('transactions');

        if (serverData.items && serverData.items.length > 0) {
          for (const serverItem of serverData.items) {
            const existing = await itemsCollection.query(
              Q.where('cloud_id', serverItem._id.toString())
            ).fetch();

            if (existing.length === 0) {
              await itemsCollection.create(item => {
                item.id = generateUUID();
                item.cloud_id = serverItem._id.toString();
                item.name = serverItem.name;
                item.barcode = serverItem.barcode;
                item.sku = serverItem.sku;
                item.price = serverItem.price;
                item.unit = serverItem.unit;
                item.category = serverItem.category;
                item.inventory_qty = serverItem.inventory_qty;
                item.is_synced = true;
                item.sync_status = 'synced';
                item.synced_at = new Date().toISOString();
                item.created_at = Date.now();
                item.updated_at = Date.now();
              });
              appliedCount++;
            }
          }
        }

        if (serverData.customers && serverData.customers.length > 0) {
          for (const serverCustomer of serverData.customers) {
            const existing = await customersCollection.query(
              Q.where('cloud_id', serverCustomer._id.toString())
            ).fetch();

            if (existing.length === 0) {
              await customersCollection.create(customer => {
                customer.id = generateUUID();
                customer.cloud_id = serverCustomer._id.toString();
                customer.name = serverCustomer.name;
                customer.phone = serverCustomer.phone;
                customer.email = serverCustomer.email;
                customer.address = serverCustomer.address;
                customer.is_synced = true;
                customer.sync_status = 'synced';
                customer.synced_at = new Date().toISOString();
                customer.created_at = Date.now();
                customer.updated_at = Date.now();
              });
              appliedCount++;
            }
          }
        }

        if (serverData.transactions && serverData.transactions.length > 0) {
          for (const serverTx of serverData.transactions) {
            const existing = await transactionsCollection.query(
              Q.where('cloud_id', serverTx._id.toString())
            ).fetch();

            if (existing.length === 0) {
              await transactionsCollection.create(tx => {
                tx.id = generateUUID();
                tx.cloud_id = serverTx._id.toString();
                tx.voucher_number = serverTx.voucher_number;
                tx.customer_name = serverTx.customer_name;
                tx.date = serverTx.date;
                tx.subtotal = serverTx.subtotal;
                tx.tax = serverTx.tax;
                tx.discount = serverTx.discount;
                tx.grand_total = serverTx.grand_total;
                tx.payment_type = serverTx.payment_type;
                tx.is_synced = true;
                tx.sync_status = 'synced';
                tx.synced_at = new Date().toISOString();
                tx.created_at = Date.now();
                tx.updated_at = Date.now();
              });
              appliedCount++;
            }
          }
        }
      });
    } catch (error) {
      console.error('Error applying server changes:', error);
    }

    return appliedCount;
  }

  async performFullSync(options = {}) {
    if (this.isSyncing) {
      return { success: false, error: 'Sync already in progress' };
    }

    try {
      this.isSyncing = true;
      this.syncErrors = [];
      console.log('🔄 Starting full sync...');

      const canSync = await this.canSync();
      if (!canSync) {
        return { 
          success: false, 
          error: 'Cannot sync - offline or not authenticated',
          offline: true 
        };
      }

      const user = simpleAuthService.getCurrentUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const pushResult = await this.pushLocalChanges(user.id);
      const pullResult = await this.pullServerChanges(user.id);

      this.lastSyncTime = new Date().toISOString();

      const result = {
        success: pushResult.success && pullResult.success,
        pushed: pushResult.synced || 0,
        pulled: pullResult.synced || 0,
        conflicts: [...(pushResult.conflicts || []), ...(pullResult.conflicts || [])],
        lastSyncTime: this.lastSyncTime,
        errors: this.syncErrors
      };

      if (result.success && options.showNotification) {
        console.log('✅ Full sync completed successfully');
      }

      return result;
    } catch (error) {
      console.error('Full sync error:', error);
      return { success: false, error: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  async syncAndLogout() {
    try {
      const syncResult = await this.performFullSync({ showNotification: true });
      
      if (!syncResult.success) {
        console.warn('⚠️  Sync failed before logout:', syncResult.error);
      }

      // No logout needed with simple auth - data persists
      return {
        success: syncResult.success,
        syncResult,
        message: syncResult.success ? 'Data synced successfully' : 'Sync failed'
      };
    } catch (error) {
      console.error('Sync error:', error);
      return { success: false, error: error.message };
    }
  }

  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      progress: this.syncProgress,
      errors: this.syncErrors,
    };
  }
}

export default new ComprehensiveSyncService();
