import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, ScrollView, ActivityIndicator} from 'react-native';
import {database} from '../db';
import {Q} from '@nozbe/watermelondb';
import {formatCurrency} from '../utils/formatters';
import {Ionicons} from '@expo/vector-icons';
import enhancedReportsService from '../services/enhancedReportsService';

// Separate component for sale items to properly use hooks
function SaleItem({item, index, isExpanded, onToggle, onDelete}) {
  const [transactionLines, setTransactionLines] = useState([]);
  
  useEffect(() => {
    let isMounted = true;
    
    const loadTransactionLines = async (transactionId) => {
      try {
        const linesCollection = database?.collections?.get('transaction_lines');
        if (!linesCollection) return;
        
        const lines = await linesCollection
          .query(Q.where('transaction_id', transactionId))
          .fetch();
          
        if (isMounted) {
          setTransactionLines(lines);
        }
      } catch (error) {
        console.error('Error loading transaction lines:', error);
        if (isMounted) {
          setTransactionLines([]);
        }
      }
    };
    
    if (isExpanded && item?.id) {
      loadTransactionLines(item.id);
    } else {
      setTransactionLines([]);
    }
    
    return () => {
      isMounted = false;
    };
  }, [isExpanded, item?.id]);
  
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'});
  };
  
  return (
    <TouchableOpacity 
      style={styles.saleCard} 
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.saleHeader}>
        <View style={styles.saleHeaderLeft}>
          <Text style={styles.saleNumber}>Sale #{index + 1}</Text>
          <Text style={styles.saleId}>ID: {item.id.slice(0, 8)}...</Text>
          <Text style={styles.saleTime}>{formatTime(item.date)}</Text>
          {item.customerName && (
            <View style={styles.customerRow}>
              <Ionicons name="person" size={14} color="#6B46C1" />
              <Text style={styles.customerName}> {item.customerName}</Text>
            </View>
          )}
        </View>
        <Text style={styles.saleAmount}>{formatCurrency(item.grandTotal)}</Text>
      </View>

      <View style={styles.saleDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Payment:</Text>
          <Text style={styles.detailValue}>{item.paymentType || 'Cash'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Items:</Text>
          <Text style={styles.detailValue}>{item.itemCount} ({item.unitCount} units)</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Subtotal:</Text>
          <Text style={styles.detailValue}>{formatCurrency(item.subtotal)}</Text>
        </View>
        {item.tax > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tax:</Text>
            <Text style={styles.detailValue}>{formatCurrency(item.tax)}</Text>
          </View>
        )}
        {item.discount > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Discount:</Text>
            <Text style={styles.detailValue}>-{formatCurrency(item.discount)}</Text>
          </View>
        )}
      </View>

      {/* Expanded Item Details */}
      {isExpanded && transactionLines.length > 0 && (
        <View style={styles.itemsSection}>
          <Text style={styles.itemsSectionTitle}>Items Purchased:</Text>
          {transactionLines.map((line, idx) => (
            <View key={line.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{line.itemName}</Text>
                <Text style={styles.itemQty}>{line.quantity} × {formatCurrency(line.unitPrice)}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatCurrency(line.lineTotal)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.statusRow}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>✓ Completed</Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
          </TouchableOpacity>
          <Text style={styles.expandHint}>{isExpanded ? '▲ Less' : '▼ More'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ReportsScreen() {
  const [todaySales, setTodaySales] = useState([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSale, setExpandedSale] = useState(null);
  const [comprehensiveReport, setComprehensiveReport] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [showDetailedReport, setShowDetailedReport] = useState(false);

  useEffect(() => {
    loadTodaySales();
    loadComprehensiveReport();
    loadSyncStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadTodaySales();
      loadComprehensiveReport();
      loadSyncStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTodaySales();
    await loadComprehensiveReport();
    await loadSyncStatus();
    setRefreshing(false);
  };

  const loadTodaySales = async () => {
    try {
      const transactionsCollection = database.collections.get('transactions');
      const allTransactions = await transactionsCollection.query().fetch();

      // Filter for today's completed transactions
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      
      const todaysTransactions = allTransactions.filter(txn => {
        const txnDate = new Date(txn.date);
        const isToday = txnDate >= todayStart && txnDate <= todayEnd;
        const isCompleted = txn.status === 'completed';
        console.log('Transaction:', txn.id, 'Date:', txnDate, 'Status:', txn.status, 'IsToday:', isToday, 'IsCompleted:', isCompleted);
        return isToday && isCompleted;
      });

      // Calculate total
      const total = todaysTransactions.reduce((sum, txn) => sum + txn.grandTotal, 0);

      setTodaySales(todaysTransactions);
      setTodayTotal(total);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading today sales:', error);
      setIsLoading(false);
    }
  };

  const toggleExpanded = (id) => {
    setExpandedSale(expandedSale === id ? null : id);
  };

  const handleDeleteTransaction = async (transaction) => {
    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete this transaction? This action cannot be undone.\n\nAmount: ${formatCurrency(transaction.grandTotal)}`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.write(async () => {
                // Delete transaction lines first
                const linesCollection = database.collections.get('transaction_lines');
                const lines = await linesCollection
                  .query(Q.where('transaction_id', transaction.id))
                  .fetch();
                
                for (const line of lines) {
                  await line.markAsDeleted();
                }
                
                // Delete the transaction
                await transaction.markAsDeleted();
              });
              
              // Reload data
              await loadTodaySales();
              await loadComprehensiveReport();
              
              Alert.alert('Success', 'Transaction deleted successfully');
            } catch (error) {
              console.error('Error deleting transaction:', error);
              Alert.alert('Error', 'Failed to delete transaction');
            }
          },
        },
      ]
    );
  };

  const loadComprehensiveReport = async () => {
    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      
      const report = await enhancedReportsService.getComprehensiveSalesReport({
        startDate,
        endDate,
        includeCloud: true,
        forceRefresh: false
      });
      
      setComprehensiveReport(report);
    } catch (error) {
      console.error('Error loading comprehensive report:', error);
      // Fallback to basic report
      setComprehensiveReport(null);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const status = await enhancedReportsService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Error loading sync status:', error);
      setSyncStatus({ status: 'error' });
    }
  };

  const getSyncStatusIcon = () => {
    if (!syncStatus) return 'cloud-offline';
    
    switch (syncStatus.status) {
      case 'synced': return 'cloud-done';
      case 'pending_sync': return 'cloud-upload';
      case 'sync_failed': return 'cloud-offline';
      case 'offline': return 'cloud-offline';
      default: return 'cloud-offline';
    }
  };

  const getSyncStatusColor = () => {
    if (!syncStatus) return '#999';
    
    switch (syncStatus.status) {
      case 'synced': return '#4CAF50';
      case 'pending_sync': return '#FF9800';
      case 'sync_failed': return '#F44336';
      case 'offline': return '#999';
      default: return '#999';
    }
  };

  const renderSaleItem = ({item, index}) => {
    return (
      <SaleItem 
        item={item} 
        index={index} 
        isExpanded={expandedSale === item.id} 
        onToggle={() => toggleExpanded(item.id)}
        onDelete={handleDeleteTransaction}
      />
    );
  };

  const renderHeader = () => (
    <>
      {/* Sync Status Card */}
      {syncStatus && (
        <View style={[styles.syncCard, { borderLeftColor: getSyncStatusColor() }]}>
          <View style={styles.syncHeader}>
            <Ionicons name={getSyncStatusIcon()} size={20} color={getSyncStatusColor()} />
            <Text style={styles.syncTitle}>Sync Status</Text>
          </View>
          <Text style={styles.syncText}>
            {syncStatus.status === 'synced' && 'All data synced to cloud'}
            {syncStatus.status === 'pending_sync' && `${syncStatus.pendingChanges} changes pending sync`}
            {syncStatus.status === 'offline' && 'Working offline'}
            {syncStatus.status === 'sync_failed' && 'Sync failed - check connection'}
          </Text>
          {syncStatus.lastSync && (
            <Text style={styles.syncTime}>Last sync: {new Date(syncStatus.lastSync).toLocaleTimeString()}</Text>
          )}
        </View>
      )}

      {/* Comprehensive Report Summary */}
      {comprehensiveReport && (
        <View style={styles.comprehensiveCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="stats-chart" size={24} color="#6B46C1" />
            <Text style={styles.cardTitle}>Comprehensive Report</Text>
          </View>
          
          <View style={styles.reportGrid}>
            <View style={styles.reportItem}>
              <Text style={styles.reportLabel}>Total Revenue</Text>
              <Text style={styles.reportValue}>{formatCurrency(comprehensiveReport.summary.totalRevenue)}</Text>
            </View>
            <View style={styles.reportItem}>
              <Text style={styles.reportLabel}>Transactions</Text>
              <Text style={styles.reportValue}>{comprehensiveReport.summary.totalTransactions}</Text>
            </View>
            <View style={styles.reportItem}>
              <Text style={styles.reportLabel}>Items Sold</Text>
              <Text style={styles.reportValue}>{comprehensiveReport.summary.totalItems}</Text>
            </View>
            <View style={styles.reportItem}>
              <Text style={styles.reportLabel}>Avg Transaction</Text>
              <Text style={styles.reportValue}>{formatCurrency(comprehensiveReport.summary.averageTransactionValue)}</Text>
            </View>
          </View>

          {/* Sync Confirmation */}
          {comprehensiveReport.syncConfirmation && (
            <View style={styles.syncConfirmation}>
              <Text style={styles.syncConfirmationTitle}>Data Sync Analysis</Text>
              <Text style={styles.syncConfirmationText}>
                {comprehensiveReport.syncConfirmation.totalDiscrepancies === 0 
                  ? '✓ No discrepancies found between local and cloud data'
                  : `⚠ ${comprehensiveReport.syncConfirmation.totalDiscrepancies} discrepancies found`
                }
              </Text>
              {comprehensiveReport.syncConfirmation.localOnly.length > 0 && (
                <Text style={styles.syncDetail}>
                  {comprehensiveReport.syncConfirmation.localOnly.length} transactions only in local database
                </Text>
              )}
              {comprehensiveReport.syncConfirmation.cloudOnly.length > 0 && (
                <Text style={styles.syncDetail}>
                  {comprehensiveReport.syncConfirmation.cloudOnly.length} transactions only in cloud
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Basic Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Ionicons name="trending-up" size={24} color="#FFFFFF" />
          <Text style={styles.summaryLabel}>Today's Total Sales</Text>
        </View>
        <Text style={styles.summaryAmount}>{formatCurrency(todayTotal)}</Text>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Ionicons name="receipt" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.statText}>{todaySales.length} transactions</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.statText}>Last updated: {new Date().toLocaleTimeString()}</Text>
          </View>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="analytics-outline" size={28} color="#FFFFFF" />
          <Text style={styles.title}>Today's Reports</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.syncStatusButton}>
            <Ionicons name={getSyncStatusIcon()} size={24} color={getSyncStatusColor()} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#6B46C1" />
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : todaySales.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={64} color="#999" />
          <Text style={styles.emptyText}>No sales today</Text>
          <Text style={styles.emptySubtext}>Sales will appear here as you make them</Text>
        </View>
      ) : (
        <FlatList
          data={todaySales}
          renderItem={renderSaleItem}
          keyExtractor={item => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6B46C1']} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#6B46C1',
    padding: 16,
    paddingTop: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncStatusButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  refreshButton: {
    padding: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  syncCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  syncTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  syncText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  syncTime: {
    fontSize: 12,
    color: '#999',
  },
  comprehensiveCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  reportItem: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  reportLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  reportValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  syncConfirmation: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  syncConfirmationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  syncConfirmationText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  syncDetail: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: '#6B46C1',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 8,
  },
  summaryAmount: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 4,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  saleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  saleHeaderLeft: {
    flex: 1,
  },
  saleNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  saleId: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  saleTime: {
    fontSize: 12,
    color: '#999',
  },
  saleAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6B46C1',
  },
  saleDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#D4EDDA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#155724',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFF5F5',
  },
  expandHint: {
    fontSize: 11,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  customerName: {
    fontSize: 13,
    color: '#6B46C1',
    fontWeight: '500',
  },
  itemsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
    marginBottom: 4,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  itemQty: {
    fontSize: 12,
    color: '#666',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B46C1',
  },
});
