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
        const nowIso = new Date().toISOString();
        const nowTs = Date.now();

        if (result.items?.synced) {
          for (const syncedItem of result.items.synced) {
            const localId = syncedItem.local_id || syncedItem.id;
            if (!localId) continue;

            const items = await itemsCollection.query(
              Q.where('local_id', localId)
            ).fetch();

            if (items.length > 0) {
              await items[0].update(item => {
                item.isSynced = true;
                item.cloudId = syncedItem.cloud_id || syncedItem.cloudId || item.cloudId || null;
                item.syncedAt = nowIso;
                item.syncStatus = 'synced';
                item.lastSyncAttempt = nowIso;
                item._raw.updated_at = nowTs;
              });
            }
          }
        }

        if (result.customers?.synced) {
          for (const syncedCustomer of result.customers.synced) {
            const localId = syncedCustomer.local_id || syncedCustomer.id;
            if (!localId) continue;

            const customers = await customersCollection.query(
              Q.where('local_id', localId)
            ).fetch();

            if (customers.length > 0) {
              await customers[0].update(customer => {
                customer.isSynced = true;
                customer.cloudId = syncedCustomer.cloud_id || syncedCustomer.cloudId || customer.cloudId || null;
                customer.syncedAt = nowIso;
                customer.syncStatus = 'synced';
                customer.lastSyncAttempt = nowIso;
                customer._raw.updated_at = nowTs;
              });
            }
          }
        }

        if (result.transactions?.synced) {
          for (const syncedTx of result.transactions.synced) {
            const localId = syncedTx.local_id || syncedTx.id;
            if (!localId) continue;

            const transactions = await transactionsCollection.query(
              Q.where('local_id', localId)
            ).fetch();

            if (transactions.length > 0) {
              await transactions[0].update(tx => {
                tx.isSynced = true;
                tx.cloudId = syncedTx.cloud_id || syncedTx.cloudId || tx.cloudId || null;
                tx.syncedAt = nowIso;
                tx.syncStatus = 'synced';
                tx.lastSyncAttempt = nowIso;
                if (syncedTx.voucher_number) {
                  tx.voucherNumber = syncedTx.voucher_number;
                  tx.provisionalVoucher = null;
                }
                tx._raw.updated_at = nowTs;
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

        const normalizeTimestamp = (value) => {
          if (!value) {
            return Date.now();
          }
          const parsed = new Date(value);
          return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
        };

        const normalizeIso = (value) => {
          if (!value) {
            return new Date().toISOString();
          }
          const parsed = new Date(value);
          return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
        };

        if (serverData.items && serverData.items.length > 0) {
          for (const serverItem of serverData.items) {
            const cloudId =
              (serverItem._id && serverItem._id.toString ? serverItem._id.toString() : serverItem._id) ||
              serverItem.cloud_id ||
              serverItem.id;
            if (!cloudId) {
              continue;
            }

            const createdTs = normalizeTimestamp(serverItem.createdAt || serverItem.created_at);
            const updatedTs = normalizeTimestamp(serverItem.updatedAt || serverItem.updated_at);
            const syncedIso = normalizeIso(serverItem.syncedAt || serverItem.synced_at || serverItem.updatedAt || serverItem.updated_at);

            const existing = await itemsCollection.query(
              Q.where('cloud_id', cloudId)
            ).fetch();

            if (existing.length > 0) {
              const record = existing[0];
              const localUpdated = record._raw?.updated_at ?? 0;

              if (updatedTs >= localUpdated) {
                await record.update(item => {
                  item.name = serverItem.name ?? item.name;
                  item.barcode = serverItem.barcode ?? item.barcode;
                  item.sku = serverItem.sku ?? item.sku;
                  item.price = serverItem.price ?? item.price;
                  item.unit = serverItem.unit ?? item.unit;
                  item.category = serverItem.category ?? item.category;
                  item.inventoryQty = serverItem.inventory_qty ?? item.inventoryQty;
                  item.recommended =
                    typeof serverItem.recommended === 'boolean' ? serverItem.recommended : item.recommended;
                  item.userId = serverItem.user_id || item.userId || null;
                  item.isSynced = true;
                  item.syncStatus = 'synced';
                  item.syncedAt = syncedIso;
                  item.lastSyncAttempt = syncedIso;
                  item._raw.updated_at = updatedTs;
                });
              }
            } else {
              await itemsCollection.create(item => {
                item.localId = serverItem.local_id || generateUUID();
                item.cloudId = cloudId;
                item.userId = serverItem.user_id || null;
                item.name = serverItem.name || '';
                item.barcode = serverItem.barcode || null;
                item.sku = serverItem.sku || null;
                item.price = serverItem.price ?? 0;
                item.unit = serverItem.unit || 'pc';
                item.category = serverItem.category || null;
                item.inventoryQty = serverItem.inventory_qty ?? 0;
                item.recommended = !!serverItem.recommended;
                item.isSynced = true;
                item.syncStatus = 'synced';
                item.syncedAt = syncedIso;
                item.lastSyncAttempt = syncedIso;
                item._raw.created_at = createdTs;
                item._raw.updated_at = updatedTs;
              });
              appliedCount++;
            }
          }
        }

        if (serverData.customers && serverData.customers.length > 0) {
          for (const serverCustomer of serverData.customers) {
            const cloudId =
              (serverCustomer._id && serverCustomer._id.toString ? serverCustomer._id.toString() : serverCustomer._id) ||
              serverCustomer.cloud_id ||
              serverCustomer.id;
            if (!cloudId) {
              continue;
            }

            const createdTs = normalizeTimestamp(serverCustomer.createdAt || serverCustomer.created_at);
            const updatedTs = normalizeTimestamp(serverCustomer.updatedAt || serverCustomer.updated_at);
            const syncedIso = normalizeIso(serverCustomer.syncedAt || serverCustomer.synced_at || serverCustomer.updatedAt || serverCustomer.updated_at);

            const existing = await customersCollection.query(
              Q.where('cloud_id', cloudId)
            ).fetch();

            if (existing.length > 0) {
              const record = existing[0];
              const localUpdated = record._raw?.updated_at ?? 0;

              if (updatedTs >= localUpdated) {
                await record.update(customer => {
                  customer.name = serverCustomer.name ?? customer.name;
                  customer.phone = serverCustomer.phone ?? customer.phone;
                  customer.email = serverCustomer.email ?? customer.email;
                  customer.address = serverCustomer.address ?? customer.address;
                  customer.userId = serverCustomer.user_id || customer.userId || null;
                  customer.isSynced = true;
                  customer.syncStatus = 'synced';
                  customer.syncedAt = syncedIso;
                  customer.lastSyncAttempt = syncedIso;
                  customer._raw.updated_at = updatedTs;
                });
              }
            } else {
              await customersCollection.create(customer => {
                customer.localId = serverCustomer.local_id || generateUUID();
                customer.cloudId = cloudId;
                customer.userId = serverCustomer.user_id || null;
                customer.name = serverCustomer.name || 'Customer';
                customer.phone = serverCustomer.phone || null;
                customer.email = serverCustomer.email || null;
                customer.address = serverCustomer.address || null;
                customer.isSynced = true;
                customer.syncStatus = 'synced';
                customer.syncedAt = syncedIso;
                customer.lastSyncAttempt = syncedIso;
                customer._raw.created_at = createdTs;
                customer._raw.updated_at = updatedTs;
              });
              appliedCount++;
            }
          }
        }

        if (serverData.transactions && serverData.transactions.length > 0) {
          for (const serverTx of serverData.transactions) {
            const cloudId =
              (serverTx._id && serverTx._id.toString ? serverTx._id.toString() : serverTx._id) ||
              serverTx.cloud_id ||
              serverTx.id;
            if (!cloudId) {
              continue;
            }

            const createdTs = normalizeTimestamp(serverTx.createdAt || serverTx.created_at);
            const updatedTs = normalizeTimestamp(serverTx.updatedAt || serverTx.updated_at);
            const syncedIso = normalizeIso(serverTx.syncedAt || serverTx.synced_at || serverTx.updatedAt || serverTx.updated_at);

            const existing = await transactionsCollection.query(
              Q.where('cloud_id', cloudId)
            ).fetch();

            if (existing.length > 0) {
              const record = existing[0];
              const localUpdated = record._raw?.updated_at ?? 0;

              if (updatedTs >= localUpdated) {
                await record.update(tx => {
                  tx.voucherNumber = serverTx.voucher_number ?? tx.voucherNumber;
                  tx.provisionalVoucher = serverTx.provisional_voucher ?? tx.provisionalVoucher;
                  tx.customerId = serverTx.customer_id ?? tx.customerId;
                  tx.customerName = serverTx.customer_name ?? tx.customerName;
                  tx.customerMobile = serverTx.customer_mobile ?? tx.customerMobile;
                  tx.date = serverTx.date ?? tx.date;
                  tx.subtotal = serverTx.subtotal ?? tx.subtotal;
                  tx.tax = serverTx.tax ?? tx.tax;
                  tx.discount = serverTx.discount ?? tx.discount;
                  tx.otherCharges = serverTx.other_charges ?? tx.otherCharges;
                  tx.grandTotal = serverTx.grand_total ?? tx.grandTotal;
                  tx.itemCount = serverTx.item_count ?? tx.itemCount;
                  tx.unitCount = serverTx.unit_count ?? tx.unitCount;
                  tx.paymentType = serverTx.payment_type ?? tx.paymentType;
                  tx.status = serverTx.status ?? tx.status;
                  tx.userId = serverTx.user_id || tx.userId || null;
                  tx.isSynced = true;
                  tx.syncStatus = 'synced';
                  tx.syncedAt = syncedIso;
                  tx.lastSyncAttempt = syncedIso;
                  tx._raw.updated_at = updatedTs;
                });
              }
            } else {
              await transactionsCollection.create(tx => {
                tx.localId = serverTx.local_id || generateUUID();
                tx.cloudId = cloudId;
                tx.userId = serverTx.user_id || null;
                tx.voucherNumber = serverTx.voucher_number || null;
                tx.provisionalVoucher = serverTx.provisional_voucher || null;
                tx.customerId = serverTx.customer_id || null;
                tx.customerName = serverTx.customer_name || null;
                tx.customerMobile = serverTx.customer_mobile || null;
                tx.date = serverTx.date || new Date().toISOString();
                tx.subtotal = serverTx.subtotal ?? 0;
                tx.tax = serverTx.tax ?? 0;
                tx.discount = serverTx.discount ?? 0;
                tx.otherCharges = serverTx.other_charges ?? 0;
                tx.grandTotal = serverTx.grand_total ?? 0;
                tx.itemCount = serverTx.item_count ?? 0;
                tx.unitCount = serverTx.unit_count ?? 0;
                tx.paymentType = serverTx.payment_type || null;
                tx.status = serverTx.status || 'completed';
                tx.isSynced = true;
                tx.syncStatus = 'synced';
                tx.syncedAt = syncedIso;
                tx.lastSyncAttempt = syncedIso;
                tx._raw.created_at = createdTs;
                tx._raw.updated_at = updatedTs;
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
