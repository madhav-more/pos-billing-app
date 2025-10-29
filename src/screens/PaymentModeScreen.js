import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {formatCurrency} from '../utils/formatters';
import transactionService from '../services/transactionService';
import {useCart} from '../context/CartContext';

export default function PaymentModeScreen({route, navigation}) {
  const {cartTotal, cartLines, totals, taxPercent, discount, otherCharges} = route.params || {};
  const {clearCart} = useCart();
  const [selectedPaymentMode, setSelectedPaymentMode] = useState(null);
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [showGenerateSell, setShowGenerateSell] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);

  const paymentModes = [
    {
      id: 'cash',
      name: 'Cash',
      icon: 'cash-outline',
      color: '#4CAF50',
    },
    {
      id: 'debit_card',
      name: 'Debit Card',
      icon: 'card-outline',
      color: '#FF9800',
    },
    {
      id: 'credit_card',
      name: 'Credit Card',
      icon: 'card-outline',
      color: '#FF9800',
    },
    {
      id: 'credit',
      name: 'Credit',
      icon: 'calendar-outline',
      color: '#2196F3',
    },
    {
      id: 'upi',
      name: 'UPI',
      icon: 'phone-portrait-outline',
      color: '#9C27B0',
    },
    {
      id: 'add_new',
      name: 'Add New',
      icon: 'add-circle-outline',
      color: '#000000',
    },
  ];

  const handlePaymentModeSelect = (mode) => {
    if (mode.id === 'add_new') {
      Alert.alert('Add New Payment', 'This feature will be available soon');
      return;
    }

    setSelectedPaymentMode(mode);
    
    // Show generate sell button for cash payment
    if (mode.id === 'cash') {
      setShowGenerateSell(true);
    } else {
      setShowGenerateSell(false);
    }
  };

  const handleGenerateSell = async () => {
    if (!selectedPaymentMode) {
      Alert.alert('Error', 'Please select a payment mode');
      return;
    }

    setIsProcessing(true);

    try {
      // Process the payment using the transaction service
      const result = await transactionService.processPayment({
        cartLines,
        totals,
        paymentMode: selectedPaymentMode.id,
        customerName: customerName || 'Walk-in Customer',
        customerMobile: customerMobile,
        customerEmail: customerEmail,
        customerAddress: customerAddress,
        taxPercent,
        discount,
        otherCharges,
      });

      if (result.success) {
        // Clear the cart
        clearCart();

        // Navigate to PaymentSuccessScreen
        navigation.navigate('PaymentSuccess', {
          total: cartTotal,
          paymentMode: selectedPaymentMode.name,
          customerName: customerName || 'Walk-in Customer',
          customerMobile: customerMobile,
          isOffline: false,
          transactionId: result.transactionId,
        });
      } else {
        Alert.alert('Error', result.message || 'Failed to process payment');
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      Alert.alert('Error', 'Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearchCustomer = () => {
    if (!customerMobile.trim()) {
      Alert.alert('Error', 'Please enter mobile number');
      return;
    }
    
    // TODO: Implement customer search
    Alert.alert('Search Customer', `Searching for customer with mobile: ${customerMobile}`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.timeText}>21:55</Text>
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.headerCenter}>
          <Ionicons name="menu" size={24} color="#FFFFFF" />
          <Text style={styles.storeName}>Sks</Text>
          <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.headerIcons}>
          <Ionicons name="person-add" size={24} color="#FFFFFF" />
          <Ionicons name="chatbubble" size={24} color="#FFFFFF" />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Customer Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CUSTOMER DETAILS (OPTIONAL)</Text>
          <View style={styles.customerCard}>
            <View style={styles.inputRow}>
              <View style={styles.mobileInputContainer}>
                <Text style={styles.countryCode}>+91</Text>
                <TextInput
                  style={styles.mobileInput}
                  value={customerMobile}
                  onChangeText={setCustomerMobile}
                  placeholder="Mobile Number"
                  keyboardType="phone-pad"
                />
                <TouchableOpacity style={styles.searchButton} onPress={handleSearchCustomer}>
                  <Ionicons name="search" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            <TextInput
              style={styles.customerNameInput}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Customer name"
            />
            <TouchableOpacity 
              style={styles.arrowContainer}
              onPress={() => setShowCustomerDetails(!showCustomerDetails)}>
              <Ionicons 
                name={showCustomerDetails ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#6B46C1" 
              />
            </TouchableOpacity>
          </View>

          {/* Additional Customer Details */}
          {showCustomerDetails && (
            <View style={styles.additionalDetails}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={customerEmail}
                  onChangeText={setCustomerEmail}
                  placeholder="customer@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={[styles.input, styles.addressInput]}
                  value={customerAddress}
                  onChangeText={setCustomerAddress}
                  placeholder="Enter customer address"
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          )}
        </View>

        {/* Payment Mode Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SELECT PAYMENT MODE</Text>
          <View style={styles.paymentGrid}>
            {paymentModes.map((mode) => (
              <TouchableOpacity
                key={mode.id}
                style={[
                  styles.paymentCard,
                  selectedPaymentMode?.id === mode.id && styles.paymentCardSelected,
                ]}
                onPress={() => handlePaymentModeSelect(mode)}>
                <View style={[styles.paymentIcon, {backgroundColor: mode.color}]}>
                  <Ionicons name={mode.icon} size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.paymentName}>{mode.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Generate Sell Button (for Cash) */}
        {showGenerateSell && (
          <View style={styles.generateSellContainer}>
            <TouchableOpacity 
              style={[styles.generateSellButton, isProcessing && styles.generateSellButtonDisabled]} 
              onPress={handleGenerateSell}
              disabled={isProcessing}>
              <Text style={styles.generateSellButtonText}>
                {isProcessing ? 'PROCESSING...' : 'GENERATE SELL'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Total Amount Display */}
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>{formatCurrency(cartTotal || 0)}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#1E3A8A',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  storeName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 10,
  },
  headerIcons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginBottom: 15,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputRow: {
    marginBottom: 15,
  },
  mobileInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  countryCode: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
  mobileInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  searchButton: {
    backgroundColor: '#6B46C1',
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerNameInput: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
    fontSize: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  arrowContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  additionalDetails: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  addressInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  paymentCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  paymentCardSelected: {
    borderWidth: 2,
    borderColor: '#6B46C1',
  },
  paymentIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  paymentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  generateSellContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  generateSellButton: {
    backgroundColor: '#6B46C1',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  generateSellButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  generateSellButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.7,
  },
  totalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#6B46C1',
  },
});
