import { database } from '../db';
import enhancedAuthService from './enhancedAuthService';
import comprehensiveSyncService from './comprehensiveSyncService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

class ReportsSyncService {
  constructor() {
    this.lastCloudSyncTime = null;
    this.cloudSyncStatus = null;
  }

  async getReportWithCloudConfirmation(startDate, endDate) {
    try {
      const localStats = await this.getLocalReportStats(startDate, endDate);
      
      let cloudStats = null;
      let syncMessage = null;
      let isSynced = false;

      const authStatus = enhancedAuthService.getAuthStatus();
      
      if (authStatus.isOnline && authStatus.authenticated) {
        try {
          cloudStats = await this.getCloudReportStats(startDate, endDate);
          
          if (cloudStats) {
            isSynced = true;
            this.lastCloudSyncTime = new Date().toISOString();
            this.cloudSyncStatus = 'success';
            
            syncMessage = `✅ All data successfully synced to cloud!\n\nCloud Records: ${cloudStats.totalTransactions}\nLocal Records: ${localStats.totalTransactions}`;
          }
        } catch (error) {
          console.warn('Cloud report sync failed:', error);
          syncMessage = `⚠️ Cloud sync failed: ${error.message}\nLocal data is available offline`;
        }
      } else {
        syncMessage = '📱 Offline - Using local data. Sync when online to confirm cloud backup.';
      }

      return {
        localStats,
        cloudStats,
        syncMessage,
        isSynced,
        lastCloudSyncTime: this.lastCloudSyncTime,
        reportDate: { start: startDate, end: endDate },
      };
    } catch (error) {
      console.error('Error getting report with cloud confirmation:', error);
      return {
        localStats: null,
        cloudStats: null,
        syncMessage: `❌ Error: ${error.message}`,
        isSynced: false,
        error: error.message,
      };
    }
  }

  async getLocalReportStats(startDate, endDate) {
    try {
      const transactionsCollection = database.collections.get('transactions');
      const customersCollection = database.collections.get('customers');

      const dateRange = {
        $gte: startDate.toISOString ? startDate.toISOString() : startDate,
        $lte: endDate.toISOString ? endDate.toISOString() : endDate,
      };

      const allTransactions = await transactionsCollection.query().fetch();
      
      const transactions = allTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= new Date(dateRange.$gte) && txDate <= new Date(dateRange.$lte);
      });

      const customers = await customersCollection.query().fetch();

      const stats = {
        totalTransactions: transactions.length,
        totalRevenue: transactions.reduce((sum, t) => sum + (t.grand_total || 0), 0),
        totalItems: transactions.reduce((sum, t) => sum + (t.item_count || 0), 0),
        totalTax: transactions.reduce((sum, t) => sum + (t.tax || 0), 0),
        totalDiscount: transactions.reduce((sum, t) => sum + (t.discount || 0), 0),
        avgTransactionValue: transactions.length > 0 ? 
          transactions.reduce((sum, t) => sum + (t.grand_total || 0), 0) / transactions.length : 0,
        paymentMethods: this.aggregatePaymentMethods(transactions),
        syncedCount: transactions.filter(t => t.is_synced).length,
        unsyncedCount: transactions.filter(t => !t.is_synced).length,
        totalCustomers: customers.length,
      };

      return stats;
    } catch (error) {
      console.error('Error getting local report stats:', error);
      return null;
    }
  }

  async getCloudReportStats(startDate, endDate) {
    try {
      const token = enhancedAuthService.getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const response = await fetch(`${API_BASE_URL}/reports/stats?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting cloud report stats:', error);
      throw error;
    }
  }

  aggregatePaymentMethods(transactions) {
    const methods = {};
    
    transactions.forEach(tx => {
      const method = tx.payment_type || 'unknown';
      methods[method] = (methods[method] || 0) + (tx.grand_total || 0);
    });

    return methods;
  }

  async pushReportsToCloud() {
    try {
      const authStatus = enhancedAuthService.getAuthStatus();
      
      if (!authStatus.isOnline || !authStatus.authenticated) {
        return {
          success: false,
          message: 'Cannot sync reports - offline or not authenticated',
        };
      }

      const syncResult = await comprehensiveSyncService.performFullSync({
        showNotification: false,
      });

      if (syncResult.success) {
        this.lastCloudSyncTime = new Date().toISOString();
        this.cloudSyncStatus = 'success';
        
        return {
          success: true,
          message: `✅ All data successfully stored to cloud database!\n\nSynced ${syncResult.pushed} items pushed and ${syncResult.pulled} items pulled.`,
          timestamp: this.lastCloudSyncTime,
        };
      } else {
        return {
          success: false,
          message: `Failed to sync reports: ${syncResult.error}`,
        };
      }
    } catch (error) {
      console.error('Error pushing reports to cloud:', error);
      return {
        success: false,
        message: `Error syncing reports: ${error.message}`,
      };
    }
  }

  getLastCloudSyncTime() {
    return this.lastCloudSyncTime;
  }

  getCloudSyncStatus() {
    return this.cloudSyncStatus;
  }
}

export default new ReportsSyncService();
