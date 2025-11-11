import { v4 as uuidv4 } from 'uuid';
import NetInfo from '@react-native-community/netinfo';
import { database } from '../db';
import enhancedAuthService from './enhancedAuthService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * Enhanced Sync Service with deduplication, conflict resolution, and comprehensive error handling
 */
class EnhancedSyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncQueue = [];
  }

  /**
   * Generate idempotency key for preventing duplicate operations
   */
  generateIdempotencyKey(entityType, localId) {
    return `${entityType}-${localId}-${Date.now()}`;
  }

  /**
   * Check if device is online and authenticated
   */
  async canSync() {
    const netInfo = await NetInfo.fetch();
    const isOnline = netInfo.isConnected && netInfo.isInternetReachable;
    const isAuthenticated = enhancedAuthService.isAuthenticated();
    
    return isOnline && isAuthenticated;
  }

  /**
   * Full sync - push local changes, pull server changes, resolve conflicts
   */
  async performFullSync(options = {}) {
    if (this.isSyncing) {
      return { success: false, error: 'Sync already in progress' };
    }

    try {
      this.isSyncing = true;
      console.log('🔄 Starting full sync...');

      const canSync = await this.canSync();
      if (!canSync) {
        return { 
          success: false, 
          error: 'Cannot sync - offline or not authenticated',
          offline: true 
        };
      }

      const user = enhancedAuthService.getCurrentUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // 1. Push local changes to server
      const pushResult = await this.pushLocalChanges(user.id);
      if (!pushResult.success) {
        console.error('Push failed:', pushResult.error);
      }

      // 2. Pull server changes
      const pullResult = await this.pullServerChanges(user.id);
      if (!pullResult.success) {
        console.error('Pull failed:', pullResult.error);
      }

      // 3. Resolve conflicts if any
      const conflicts = [...(pushResult.conflicts || []), ...(pullResult.conflicts || [])];
      if (conflicts.length > 0) {
        await this.resolveConflicts(conflicts);
      }

      this.lastSyncTime = new Date().toISOString();

      const result = {
        success: pushResult.success && pullResult.success,
        pushed: pushResult.synced || 0,
        pulled: pullResult.synced || 0,
        conflicts: conflicts.length,
        lastSyncTime: this.lastSyncTime
      };

      if (options.showNotification && result.success) {
        // Show success notification
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

  /**
   * Push local changes to server
   */
  async pushLocalChanges(userId) {
    try {
      const unsyncedData = await this.getUnsyncedData();
      if (unsyncedData.items.length === 0 && unsyncedData.customers.length === 0 && unsyncedData.transactions.length === 0) {
        return { success: true, synced: 0, conflicts: [] };
      }

      const token = enhancedAuthService.getAuthToken();
      const response = await fetch(`${API_BASE_URL}/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: unsyncedData.items,
          customers: unsyncedData.customers,
          transactions: unsyncedData.transactions
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Mark successfully synced items
        await this.markAsSynced(result);
        
        return {
          success: true,
          synced: result.items.synced.length + result.customers.synced.length + result.transactions.synced.length,
          conflicts: [...result.items.conflicts, ...result.customers.conflicts, ...result.transactions.conflicts]
        };
      } else {
        return { success: false, error: result.error || 'Push failed' };
      }
    } catch (error) {
      console.error('Push local changes error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pull server changes
   */
  async pullServerChanges(userId) {
    try {
      const token = enhancedAuthService.getAuthToken();
      const since = this.lastSyncTime || new Date(0).toISOString();
      
      const response = await fetch(`${API_BASE_URL}/sync/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ since }),
      });

      const result = await response.json();

      if (response.ok) {
        // Apply server changes locally
        const applied = await this.applyServerChanges(result);
        
        return {
          success: true,
          synced: applied,
          conflicts: []
        };
      } else {
        return { success: false, error: result.error || 'Pull failed' };
      }
    } catch (error) {
      console.error('Pull server changes error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all unsynced local data
   */
  async getUnsyncedData() {
    const itemsCollection = database.collections.get('items');
    const customersCollection = database.collections.get('customers');
    const transactionsCollection = database.collections.get('transactions');

    const [allItems, allCustomers, allTransactions] = await Promise.all([
      itemsCollection.query().fetch(),
      customersCollection.query().fetch(),
      transactionsCollection.query().fetch()
    ]);

    const unsyncedItems = allItems.filter(item => !item.isSynced);
    const unsyncedCustomers = allCustomers.filter(customer => !customer.isSynced);
    const unsyncedTransactions = allTransactions.filter(transaction => !transaction.isSynced);

    return {
      items: unsyncedItems.map(item => this.serializeItem(item)),
      customers: unsyncedCustomers.map(customer => this.serializeCustomer(customer)),
      transactions: unsyncedTransactions.map(transaction => this.serializeTransaction(transaction))
    };
  }

  /**
   * Serialize item for server sync
   */
  serializeItem(item) {
    return {
      id: item.localId,
      cloud_id: item.cloudId,
      user_id: item.userId,
      name: item.name,
      barcode: item.barcode,
      sku: item.sku,
      price: item.price,
      unit: item.unit,
      image_path: item.imagePath,
      category: item.category,
      recommended: item.recommended,
      default_quantity: item.defaultQuantity,
      inventory_qty: item.inventoryQty,
      idempotency_key: item.idempotencyKey || this.generateIdempotencyKey('item', item.localId),
      updated_at: item.updatedAt
    };
  }

  /**
   * Serialize customer for server sync
   */
  serializeCustomer(customer) {
    return {
      id: customer.localId,
      cloud_id: customer.cloudId,
      user_id: customer.userId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      idempotency_key: customer.idempotencyKey || this.generateIdempotencyKey('customer', customer.localId),
      updated_at: customer.updatedAt
    };
  }

  /**
   * Serialize transaction for server sync
   */
  serializeTransaction(transaction) {
    return {
      id: transaction.localId,
      cloud_id: transaction.cloudId,
      user_id: transaction.userId,
      voucher_number: transaction.voucherNumber,
      provisional_voucher: transaction.provisionalVoucher,
      customer_id: transaction.customerId,
      customer_name: transaction.customerName,
      customer_mobile: transaction.customerMobile,
      date: transaction.date,
      subtotal: transaction.subtotal,
      tax: transaction.tax,
      discount: transaction.discount,
      other_charges: transaction.otherCharges,
      grand_total: transaction.grandTotal,
      item_count: transaction.itemCount,
      unit_count: transaction.unitCount,
      payment_type: transaction.paymentType,
      status: transaction.status,
      receipt_file_path: transaction.receiptFilePath,
      idempotency_key: transaction.idempotencyKey || this.generateIdempotencyKey('transaction', transaction.localId),
      updated_at: transaction.updatedAt,
      lines: transaction.lines ? transaction.lines.map(line => this.serializeTransactionLine(line)) : []
    };
  }

  /**
   * Serialize transaction line
   */
  serializeTransactionLine(line) {
    return {
      id: line.localId,
      cloud_id: line.cloudId,
      user_id: line.userId,
      transaction_id: line.transactionId,
      item_id: line.itemId,
      item_name: line.itemName,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      per_line_discount: line.perLineDiscount,
      line_total: line.lineTotal,
      idempotency_key: line.idempotencyKey || this.generateIdempotencyKey('transaction_line', line.localId),
      updated_at: line.updatedAt
    };
  }

  /**
   * Mark entities as synced after successful push
   */
  async markAsSynced(syncResult) {
    await database.write(async () => {
      // Mark items as synced
      if (syncResult.items && syncResult.items.synced) {
        for (const syncedItem of syncResult.items.synced) {
          const localItem = await database.collections.get('items').find(syncedItem.id);
          if (localItem) {
            await localItem.update(item => {
              item.isSynced = true;
              item.syncedAt = new Date().toISOString();
              item.cloudId = syncedItem.id;
            });
          }
        }
      }

      // Mark customers as synced
      if (syncResult.customers && syncResult.customers.synced) {
        for (const syncedCustomer of syncResult.customers.synced) {
          const localCustomer = await database.collections.get('customers').find(syncedCustomer.id);
          if (localCustomer) {
            await localCustomer.update(customer => {
              customer.isSynced = true;
              customer.syncedAt = new Date().toISOString();
              customer.cloudId = syncedCustomer.id;
            });
          }
        }
      }

      // Mark transactions as synced and update voucher numbers
      if (syncResult.transactions && syncResult.transactions.synced) {
        for (const syncedTransaction of syncResult.transactions.synced) {
          const localTransaction = await database.collections.get('transactions').find(syncedTransaction.id);
          if (localTransaction) {
            await localTransaction.update(transaction => {
              transaction.isSynced = true;
              transaction.syncedAt = new Date().toISOString();
              transaction.cloudId = syncedTransaction.id;
              // Update voucher number if server provided one
              if (syncedTransaction.voucher_number) {
                transaction.voucherNumber = syncedTransaction.voucher_number;
                transaction.provisionalVoucher = null;
              }
            });
          }
        }
      }
    });
  }

  /**
   * Apply server changes locally
   */
  async applyServerChanges(serverData) {
    let appliedCount = 0;

    await database.write(async () => {
      // Apply items
      if (serverData.items && serverData.items.length > 0) {
        const allItems = await database.collections.get('items').query().fetch();
        for (const serverItem of serverData.items) {
          const existingItem = allItems.find(item => item.cloudId === serverItem.id);
          if (!existingItem) {
            // Create new item from server
            await database.collections.get('items').create(item => {
              item.localId = uuidv4();
              item.cloudId = serverItem.id;
              item.userId = serverItem.user_id;
              item.name = serverItem.name;
              item.barcode = serverItem.barcode;
              item.sku = serverItem.sku;
              item.price = serverItem.price;
              item.unit = serverItem.unit;
              item.imagePath = serverItem.image_path;
              item.category = serverItem.category;
              item.recommended = serverItem.recommended;
              item.defaultQuantity = serverItem.default_quantity;
              item.inventoryQty = serverItem.inventory_qty;
              item.isSynced = true;
              item.syncedAt = new Date().toISOString();
            });
            appliedCount++;
          }
        }
      }

      // Apply customers
      if (serverData.customers && serverData.customers.length > 0) {
        const allCustomers = await database.collections.get('customers').query().fetch();
        for (const serverCustomer of serverData.customers) {
          const existingCustomer = allCustomers.find(customer => customer.cloudId === serverCustomer.id);
          if (!existingCustomer) {
            // Create new customer from server
            await database.collections.get('customers').create(customer => {
              customer.localId = uuidv4();
              customer.cloudId = serverCustomer.id;
              customer.userId = serverCustomer.user_id;
              customer.name = serverCustomer.name;
              customer.phone = serverCustomer.phone;
              customer.email = serverCustomer.email;
              customer.address = serverCustomer.address;
              customer.isSynced = true;
              customer.syncedAt = new Date().toISOString();
            });
            appliedCount++;
          }
        }
      }

      // Apply transactions (append-only)
      if (serverData.transactions && serverData.transactions.length > 0) {
        const allTransactions = await database.collections.get('transactions').query().fetch();
        for (const serverTransaction of serverData.transactions) {
          const existingTransaction = allTransactions.find(transaction => transaction.cloudId === serverTransaction.id);
          if (!existingTransaction) {
            // Create new transaction from server
            await database.collections.get('transactions').create(transaction => {
              transaction.localId = uuidv4();
              transaction.cloudId = serverTransaction.id;
              transaction.userId = serverTransaction.user_id;
              transaction.voucherNumber = serverTransaction.voucher_number;
              transaction.customerId = serverTransaction.customer_id;
              transaction.customerName = serverTransaction.customer_name;
              transaction.customerMobile = serverTransaction.customer_mobile;
              transaction.date = serverTransaction.date;
              transaction.subtotal = serverTransaction.subtotal;
              transaction.tax = serverTransaction.tax;
              transaction.discount = serverTransaction.discount;
              transaction.otherCharges = serverTransaction.other_charges;
              transaction.grandTotal = serverTransaction.grand_total;
              transaction.itemCount = serverTransaction.item_count;
              transaction.unitCount = serverTransaction.unit_count;
              transaction.paymentType = serverTransaction.payment_type;
              transaction.status = serverTransaction.status;
              transaction.receiptFilePath = serverTransaction.receipt_file_path;
              transaction.isSynced = true;
              transaction.syncedAt = new Date().toISOString();
            });
            appliedCount++;
          }
        }
      }
    });

    return appliedCount;
  }

  /**
   * Resolve conflicts (simple last-write-wins strategy)
   */
  async resolveConflicts(conflicts) {
    console.log(`Resolving ${conflicts.length} conflicts`);
    // Implement conflict resolution strategy here
    // For now, just log conflicts
    conflicts.forEach(conflict => {
      console.log('Conflict:', conflict);
    });
  }

  /**
   * Sync and logout - performs full sync then logs out
   */
  async syncAndLogout() {
    try {
      // Perform full sync
      const syncResult = await this.performFullSync({ showNotification: true });
      
      if (syncResult.success) {
        console.log('✅ Sync completed before logout');
        // Show success message
      } else {
        console.warn('⚠️  Sync failed before logout:', syncResult.error);
        // Show warning but continue with logout
      }

      // Logout
      const logoutResult = await enhancedAuthService.logout();
      
      return {
        success: logoutResult.success,
        syncResult,
        message: logoutResult.success ? 'Synced and logged out successfully' : 'Logout failed'
      };
    } catch (error) {
      console.error('Sync and logout error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      canSync: this.canSync()
    };
  }

  /**
   * Get last sync time
   */
  getLastSyncTime() {
    return this.lastSyncTime;
  }

  /**
   * Get pending changes count
   */
  async getPendingChangesCount() {
    try {
      const itemsCollection = database.collections.get('items');
      const customersCollection = database.collections.get('customers');
      const transactionsCollection = database.collections.get('transactions');

      const items = await itemsCollection.query().fetch();
      const customers = await customersCollection.query().fetch();
      const transactions = await transactionsCollection.query().fetch();

      const pendingItems = items.filter(i => i.sync_status !== 'synced').length;
      const pendingCustomers = customers.filter(c => c.sync_status !== 'synced').length;
      const pendingTransactions = transactions.filter(t => t.sync_status !== 'synced').length;

      return pendingItems + pendingCustomers + pendingTransactions;
    } catch (error) {
      console.error('Error getting pending changes count:', error);
      return 0;
    }
  }
}

// Create singleton instance
const enhancedSyncService = new EnhancedSyncService();

export default enhancedSyncService;