import React, {useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {formatCurrency} from '../utils/formatters';

export default function PaymentSuccessScreen({route, navigation}) {
  const {total, isOffline = false} = route.params || {};

  useEffect(() => {
    if (isOffline) {
      // Show toast notification
      console.log('Bill/Receipt generated offline or with slow internet successfully');
    }
  }, [isOffline]);

  const handleNewSale = () => {
    // Navigate back to home and reset cart
    navigation.navigate('MainTabs', {screen: 'Today'});
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.checkmarkContainer}>
          <Text style={styles.checkmark}>✓</Text>
        </View>

        <Text style={styles.title}>Payment Successful!</Text>

        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amount}>{formatCurrency(total || 0)}</Text>
        </View>

        {isOffline && (
          <View style={styles.offlineNotice}>
            <Text style={styles.offlineText}>
              💾 Saved locally - will sync when online
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.newSaleButton} onPress={handleNewSale}>
          <Text style={styles.newSaleButtonText}>New Sale</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewReceiptButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.viewReceiptButtonText}>View Receipt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  checkmarkContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  checkmark: {
    fontSize: 72,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 32,
    textAlign: 'center',
  },
  amountContainer: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  amountLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  amount: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#6B46C1',
  },
  offlineNotice: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  offlineText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  newSaleButton: {
    backgroundColor: '#6B46C1',
    padding: 18,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  newSaleButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewReceiptButton: {
    backgroundColor: '#F5F5F5',
    padding: 18,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6B46C1',
  },
  viewReceiptButtonText: {
    color: '#6B46C1',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
