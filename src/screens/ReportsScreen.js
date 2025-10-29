import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert} from 'react-native';
import {database} from '../db';
import {formatCurrency} from '../utils/formatters';
import {Ionicons} from '@expo/vector-icons';

export default function ReportsScreen() {
  const [todaySales, setTodaySales] = useState([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSale, setExpandedSale] = useState(null);

  useEffect(() => {
    loadTodaySales();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadTodaySales, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTodaySales();
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

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'});
  };

  const toggleExpanded = (id) => {
    setExpandedSale(expandedSale === id ? null : id);
  };

  const renderSaleItem = ({item, index}) => {
    const isExpanded = expandedSale === item.id;
    
    return (
    <TouchableOpacity 
      style={styles.saleCard} 
      onPress={() => toggleExpanded(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.saleHeader}>
        <View>
          <Text style={styles.saleNumber}>Sale #{index + 1}</Text>
          <Text style={styles.saleId}>ID: {item.id.slice(0, 8)}...</Text>
          <Text style={styles.saleTime}>{formatTime(item.date)}</Text>
        </View>
        <Text style={styles.saleAmount}>{formatCurrency(item.grandTotal)}</Text>
      </View>

      <View style={styles.saleDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Items:</Text>
          <Text style={styles.detailValue}>{item.itemCount}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Units:</Text>
          <Text style={styles.detailValue}>{item.unitCount}</Text>
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

      <View style={styles.statusRow}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>✓ Completed</Text>
        </View>
        <Text style={styles.expandHint}>{isExpanded ? '▲ Tap to collapse' : '▼ Tap for details'}</Text>
      </View>
    </TouchableOpacity>
  );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="analytics-outline" size={28} color="#FFFFFF" />
          <Text style={styles.title}>Today's Reports</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

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

      {isLoading ? (
        <View style={styles.emptyContainer}>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  refreshButton: {
    padding: 8,
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
});
