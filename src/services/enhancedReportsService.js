import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import enhancedSyncService from './enhancedSyncService';
import { formatCurrency } from '../utils/formatters';

/**
 * Enhanced Reports Service with cloud sync confirmation
 */
class EnhancedReportsService {
  constructor() {
    this.reportCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get comprehensive sales report with cloud sync status
   */
  async getComprehensiveSalesReport(options = {}) {
    const {
      startDate = new Date(new Date().setHours(0, 0, 0, 0)),
      endDate = new Date(new Date().setHours(23, 59, 59, 999)),
      includeCloud = true,
      forceRefresh = false
    } = options;

    try {
      // Check cache first
      const cacheKey = `sales-${startDate.toISOString()}-${endDate.toISOString()}-${includeCloud}`;
      const cached = this.reportCache.get(cacheKey);
      if (!forceRefresh && cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.results;
      }

      // Get local data
      const localReport = await this.getLocalSalesReport(startDate, endDate);
      
      // Get cloud data if requested and online
      let cloudReport = null;
      let syncStatus = 'offline';
      let lastSyncTime = null;

      if (includeCloud && await enhancedSyncService.canSync()) {
        try {
          cloudReport = await this.getCloudSalesReport(startDate, endDate);
          syncStatus = 'synced';
          lastSyncTime = new Date().toISOString();
        } catch (error) {
          console.warn('Cloud report fetch failed:', error);
          syncStatus = 'sync_failed';
        }
      } else if (includeCloud) {
        syncStatus = 'offline';
      }

      // Combine and analyze data
      const comprehensiveReport = await this.combineReports(localReport, cloudReport, {
        startDate,
        endDate,
        syncStatus,
        lastSyncTime
      });

      // Cache results
      this.reportCache.set(cacheKey, {
        results: comprehensiveReport,
        timestamp: Date.now()
      });

      return comprehensiveReport;
    } catch (error) {
      console.error('Comprehensive sales report error:', error);
      throw error;
    }
  }

  /**
   * Get local sales report from database
   */
  async getLocalSalesReport(startDate, endDate) {
    try {
      const transactionsCollection = database.collections.get('transactions');
      const transactionLinesCollection = database.collections.get('transaction_lines');
      const itemsCollection = database.collections.get('items');
      const customersCollection = database.collections.get('customers');

      // Get transactions in date range
      const transactions = await transactionsCollection
        .query(
          Q.where('date', Q.gte(startDate.toISOString())),
          Q.where('date', Q.lte(endDate.toISOString())),
          Q.where('status', 'completed')
        )
        .fetch();

      // Get all related data
      const transactionIds = transactions.map(t => t.id);
      const transactionLines = await transactionLinesCollection
        .query(Q.where('transaction_id', Q.oneOf(transactionIds)))
        .fetch();

      // Calculate statistics
      const stats = {
        totalTransactions: transactions.length,
        totalRevenue: transactions.reduce((sum, t) => sum + (t.grandTotal || 0), 0),
        totalItems: transactions.reduce((sum, t) => sum + (t.itemCount || 0), 0),
        totalUnits: transactions.reduce((sum, t) => sum + (t.unitCount || 0), 0),
        averageTransactionValue: transactions.length > 0 ? 
          transactions.reduce((sum, t) => sum + (t.grandTotal || 0), 0) / transactions.length : 0,
        totalTax: transactions.reduce((sum, t) => sum + (t.tax || 0), 0),
        totalDiscount: transactions.reduce((sum, t) => sum + (t.discount || 0), 0),
        paymentMethodBreakdown: this.calculatePaymentBreakdown(transactions),
        hourlyBreakdown: this.calculateHourlyBreakdown(transactions),
        topItems: await this.calculateTopItems(transactionLines, itemsCollection),
        customerStats: await this.calculateCustomerStats(transactions, customersCollection)
      };

      return {
        source: 'local',
        stats,
        transactions: transactions.map(t => ({
          id: t.id,
          localId: t.localId,
          cloudId: t.cloudId,
          date: t.date,
          subtotal: t.subtotal,
          tax: t.tax,
          discount: t.discount,
          grandTotal: t.grandTotal,
          itemCount: t.itemCount,
          unitCount: t.unitCount,
          paymentType: t.paymentType,
          status: t.status,
          customerId: t.customerId,
          customerName: t.customerName,
          customerMobile: t.customerMobile,
          isSynced: t.isSynced,
          syncedAt: t.syncedAt,
          voucherNumber: t.voucherNumber,
          provisionalVoucher: t.provisionalVoucher
        })),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Local sales report error:', error);
      throw error;
    }
  }

  /**
   * Get cloud sales report from API
   */
  async getCloudSalesReport(startDate, endDate) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/reports/sales`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          from: startDate.toISOString(),
          to: endDate.toISOString()
        }
      });

      if (!response.ok) {
        throw new Error(`Cloud report API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        source: 'cloud',
        stats: data.summary,
        transactions: data.transactions,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Cloud sales report error:', error);
      throw error;
    }
  }

  /**
   * Combine local and cloud reports with sync analysis
   */
  async combineReports(localReport, cloudReport, metadata) {
    const { startDate, endDate, syncStatus, lastSyncTime } = metadata;

    let combinedStats = { ...localReport.stats };
    let discrepancies = [];
    let syncConfirmation = {
      status: syncStatus,
      lastSyncTime,
      localOnly: [],
      cloudOnly: [],
      conflicts: [],
      totalDiscrepancies: 0
    };

    if (cloudReport) {
      // Compare statistics
      const statDifferences = this.compareStats(localReport.stats, cloudReport.stats);
      if (statDifferences.length > 0) {
        discrepancies.push(...statDifferences);
      }

      // Compare transactions
      const transactionAnalysis = this.compareTransactions(
        localReport.transactions,
        cloudReport.transactions
      );
      syncConfirmation = { ...syncConfirmation, ...transactionAnalysis };

      // Use cloud stats as authoritative when synced
      if (syncStatus === 'synced') {
        combinedStats = { ...cloudReport.stats };
      }
    }

    return {
      period: {
        start: startDate,
        end: endDate,
        duration: this.formatDuration(startDate, endDate)
      },
      summary: {
        totalRevenue: combinedStats.totalRevenue,
        totalTransactions: combinedStats.totalTransactions,
        totalItems: combinedStats.totalItems,
        averageTransactionValue: combinedStats.averageTransactionValue,
        totalTax: combinedStats.totalTax,
        totalDiscount: combinedStats.totalDiscount,
        paymentMethodBreakdown: combinedStats.paymentMethodBreakdown,
        hourlyBreakdown: combinedStats.hourlyBreakdown,
        topItems: combinedStats.topItems,
        customerStats: combinedStats.customerStats
      },
      syncConfirmation: {
        ...syncConfirmation,
        totalDiscrepancies: discrepancies.length + syncConfirmation.conflicts.length,
        discrepancies
      },
      dataSources: {
        local: localReport,
        cloud: cloudReport
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Calculate payment method breakdown
   */
  calculatePaymentBreakdown(transactions) {
    const breakdown = {};
    transactions.forEach(tx => {
      const method = tx.paymentType || 'cash';
      if (!breakdown[method]) {
        breakdown[method] = { count: 0, total: 0 };
      }
      breakdown[method].count++;
      breakdown[method].total += tx.grandTotal || 0;
    });
    return breakdown;
  }

  /**
   * Calculate hourly breakdown
   */
  calculateHourlyBreakdown(transactions) {
    const hourly = Array(24).fill(0).map(() => ({ count: 0, total: 0 }));
    transactions.forEach(tx => {
      const hour = new Date(tx.date).getHours();
      hourly[hour].count++;
      hourly[hour].total += tx.grandTotal || 0;
    });
    return hourly;
  }

  /**
   * Calculate top selling items
   */
  async calculateTopItems(transactionLines, itemsCollection) {
    const itemSales = {};
    transactionLines.forEach(line => {
      const itemId = line.itemId;
      if (!itemSales[itemId]) {
        itemSales[itemId] = { quantity: 0, revenue: 0 };
      }
      itemSales[itemId].quantity += line.quantity || 0;
      itemSales[itemId].revenue += line.lineTotal || 0;
    });

    // Get item names
    const itemIds = Object.keys(itemSales);
    if (itemIds.length === 0) return [];

    const items = await itemsCollection.query(Q.where('id', Q.oneOf(itemIds))).fetch();
    const itemMap = new Map(items.map(item => [item.id, item.name]));

    return Object.entries(itemSales)
      .map(([itemId, data]) => ({
        itemId,
        itemName: itemMap.get(itemId) || 'Unknown Item',
        quantity: data.quantity,
        revenue: data.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  /**
   * Calculate customer statistics
   */
  async calculateCustomerStats(transactions, customersCollection) {
    const customerStats = {};
    transactions.forEach(tx => {
      const customerId = tx.customerId;
      if (customerId) {
        if (!customerStats[customerId]) {
          customerStats[customerId] = { count: 0, total: 0 };
        }
        customerStats[customerId].count++;
        customerStats[customerId].total += tx.grandTotal || 0;
      }
    });

    // Get customer names
    const customerIds = Object.keys(customerStats);
    if (customerIds.length === 0) {
      return { uniqueCustomers: 0, topCustomers: [] };
    }

    const customers = await customersCollection.query(Q.where('id', Q.oneOf(customerIds))).fetch();
    const customerMap = new Map(customers.map(c => [c.id, c.name]));

    const topCustomers = Object.entries(customerStats)
      .map(([customerId, data]) => ({
        customerId,
        customerName: customerMap.get(customerId) || 'Unknown Customer',
        transactionCount: data.count,
        totalSpent: data.total
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    return {
      uniqueCustomers: Object.keys(customerStats).length,
      topCustomers
    };
  }

  /**
   * Compare local and cloud statistics
   */
  compareStats(localStats, cloudStats) {
    const differences = [];
    const statKeys = ['totalTransactions', 'totalRevenue', 'totalItems', 'totalTax', 'totalDiscount'];

    statKeys.forEach(key => {
      const localValue = localStats[key] || 0;
      const cloudValue = cloudStats[key] || 0;
      if (Math.abs(localValue - cloudValue) > 0.01) {
        differences.push({
          type: 'stat_difference',
          field: key,
          localValue,
          cloudValue,
          difference: Math.abs(localValue - cloudValue)
        });
      }
    });

    return differences;
  }

  /**
   * Compare local and cloud transactions
   */
  compareTransactions(localTransactions, cloudTransactions) {
    const localMap = new Map(localTransactions.map(t => [t.id, t]));
    const cloudMap = new Map(cloudTransactions.map(t => [t.id, t]));

    const localOnly = [];
    const cloudOnly = [];
    const conflicts = [];

    // Find local-only transactions
    localTransactions.forEach(tx => {
      if (!cloudMap.has(tx.id)) {
        localOnly.push(tx);
      }
    });

    // Find cloud-only transactions and conflicts
    cloudTransactions.forEach(tx => {
      if (!localMap.has(tx.id)) {
        cloudOnly.push(tx);
      } else {
        const localTx = localMap.get(tx.id);
        if (Math.abs((localTx.grandTotal || 0) - (tx.grand_total || 0)) > 0.01) {
          conflicts.push({
            transactionId: tx.id,
            localValue: localTx.grandTotal,
            cloudValue: tx.grand_total,
            difference: Math.abs((localTx.grandTotal || 0) - (tx.grand_total || 0))
          });
        }
      }
    });

    return {
      localOnly,
      cloudOnly,
      conflicts,
      totalLocal: localTransactions.length,
      totalCloud: cloudTransactions.length
    };
  }

  /**
   * Format duration between dates
   */
  formatDuration(startDate, endDate) {
    const diffMs = endDate - startDate;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }

  /**
   * Get auth token helper
   */
  async getAuthToken() {
    try {
      const enhancedAuthService = require('./enhancedAuthService');
      return enhancedAuthService.getAuthToken();
    } catch (error) {
      console.error('Get auth token error:', error);
      return null;
    }
  }

  /**
   * Clear report cache
   */
  clearCache() {
    this.reportCache.clear();
  }

  /**
   * Get sync status for reports
   */
  async getSyncStatus() {
    try {
      const canSync = await enhancedSyncService.canSync();
      const lastSync = await enhancedSyncService.getLastSyncTime();
      const pendingChanges = await enhancedSyncService.getPendingChangesCount();
      
      return {
        canSync,
        lastSync,
        pendingChanges,
        status: canSync ? (pendingChanges > 0 ? 'pending_sync' : 'synced') : 'offline'
      };
    } catch (error) {
      console.error('Get sync status error:', error);
      return {
        canSync: false,
        lastSync: null,
        pendingChanges: 0,
        status: 'error'
      };
    }
  }
}

// Create singleton instance
const enhancedReportsService = new EnhancedReportsService();

export default enhancedReportsService;