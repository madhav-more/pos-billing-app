import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  FlatList,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {formatCurrency} from '../utils/formatters';
import transactionService from '../services/transactionService';
import {useCart} from '../context/CartContext';
import {database} from '../db';
import {Q} from '@nozbe/watermelondb';
import customerService from '../services/customerService';
import {generateUUID} from '../utils/uuid';

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
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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
    setShowGenerateSell(true); // Show generate sell button for all payment modes
  };

  const handleGenerateSell = async () => {
    if (!selectedPaymentMode) {
      Alert.alert('Error', 'Please select a payment mode');
      return;
    }

    setIsProcessing(true);

    try {
      // Save customer to database if provided
      await saveCustomer();

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

  // Search for customer by phone or name using enhanced customer service
  const searchCustomers = async (query) => {
    if (!query || query.length < 2) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      // Use enhanced customer service for better search with relevance scoring
      const searchResults = await customerService.searchCustomers(query, {
        limit: 5,
        searchFields: ['name', 'phone', 'email'],
        includeCloud: true // Include cloud search when online
      });

      setCustomerSuggestions(searchResults);
      setShowSuggestions(searchResults.length > 0);
    } catch (error) {
      console.error('Customer search error:', error);
      // Fallback to local search if enhanced service fails
      try {
        const customersCollection = database?.collections?.get('customers');
        if (customersCollection) {
          const allCustomers = await customersCollection.query().fetch();
          const lowerQuery = query.toLowerCase();
          const filtered = allCustomers.filter(customer => {
            const nameMatch = customer.name && customer.name.toLowerCase().includes(lowerQuery);
            const phoneMatch = customer.phone && customer.phone.includes(query);
            return nameMatch || phoneMatch;
          });
          setCustomerSuggestions(filtered.slice(0, 5));
          setShowSuggestions(filtered.length > 0);
        }
      } catch (fallbackError) {
        console.error('Fallback customer search error:', fallbackError);
        setCustomerSuggestions([]);
        setShowSuggestions(false);
      }
    }
  };

  // Handle customer mobile input with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerMobile) {
        searchCustomers(customerMobile);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerMobile]);

  // Handle customer name input with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerName && !customerMobile) {
        searchCustomers(customerName);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerName]);

  // Select customer from suggestions with enhanced autofill
  const selectCustomer = async (customer) => {
    try {
      // Use enhanced autofill to get complete customer data
      const autofillResult = await customerService.autoFillCustomer({
        phone: customer.phone,
        email: customer.email,
        name: customer.name
      });

      if (autofillResult.found && autofillResult.customer) {
        // Use the enhanced customer data
        const enhancedCustomer = autofillResult.customer;
        setCustomerMobile(enhancedCustomer.phone || '');
        setCustomerName(enhancedCustomer.name || '');
        setCustomerEmail(enhancedCustomer.email || '');
        setCustomerAddress(enhancedCustomer.address || '');
      } else {
        // Fallback to basic customer data
        setCustomerMobile(customer.phone || '');
        setCustomerName(customer.name || '');
        setCustomerEmail(customer.email || '');
        setCustomerAddress(customer.address || '');
      }
    } catch (error) {
      console.error('Enhanced autofill error:', error);
      // Fallback to basic customer data
      setCustomerMobile(customer.phone || '');
      setCustomerName(customer.name || '');
      setCustomerEmail(customer.email || '');
      setCustomerAddress(customer.address || '');
    }
    
    setShowSuggestions(false);
    setCustomerSuggestions([]);
  };

  // Save new customer to database using enhanced customer service
  const saveCustomer = async () => {
    if (!customerMobile && !customerName) {
      return null;
    }

    try {
      let customer = null;

      // First try to find existing customer using enhanced service
      const existingCustomer = await customerService.getCustomerByPhone(customerMobile);
      
      if (existingCustomer) {
        // Update existing customer using enhanced service
        customer = await customerService.saveCustomer({
          localId: existingCustomer.localId,
          name: customerName || existingCustomer.name,
          phone: customerMobile || existingCustomer.phone,
          email: customerEmail || existingCustomer.email,
          address: customerAddress || existingCustomer.address,
          userId: existingCustomer.userId
        });
      } else {
        // Create new customer using enhanced service
        customer = await customerService.saveCustomer({
          name: customerName || 'Customer',
          phone: customerMobile || '',
          email: customerEmail || '',
          address: customerAddress || '',
          userId: 'current_user_id' // This should be set from auth context
        });
      }

      return customer;
    } catch (error) {
      console.error('Save customer error:', error);
      // Fallback to direct database operations
      try {
        let customer = null;
        const customersCollection = database.collections.get('customers');
        let existing = [];
        
        if (customerMobile && customerMobile.trim()) {
          existing = await customersCollection
            .query(Q.where('phone', customerMobile))
            .fetch();
        }

        await database.write(async () => {
          if (existing.length > 0) {
            customer = existing[0];
            await customer.update(c => {
              if (customerName) c.name = customerName;
              if (customerEmail) c.email = customerEmail;
              if (customerAddress) c.address = customerAddress;
              c.isSynced = false;
              c.syncStatus = 'pending';
            });
          } else {
            const localId = generateUUID();
            const idempotencyKey = generateUUID();
            
            customer = await customersCollection.create(c => {
              c.localId = localId;
              c.idempotencyKey = idempotencyKey;
              c.phone = customerMobile || '';
              c.name = customerName || 'Customer';
              c.email = customerEmail || '';
              c.address = customerAddress || '';
              c.isSynced = false;
              c.syncStatus = 'pending';
              c.cloudId = null;
              c.userId = null;
            });
          }
        });

        return customer;
      } catch (fallbackError) {
        console.error('Fallback save customer error:', fallbackError);
        return null;
      }
    }
  };

  const handleSearchCustomer = () => {
    if (!customerMobile.trim()) {
      Alert.alert('Error', 'Please enter mobile number');
      return;
    }
    
    searchCustomers(customerMobile);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      
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

          {/* Customer Suggestions */}
          {showSuggestions && customerSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {customerSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.suggestionItem}
                  onPress={() => selectCustomer(item)}>
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionName}>{item.name}</Text>
                    <Text style={styles.suggestionPhone}>{item.phone}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              ))}
            </View>
          )}

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
    marginTop:50
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
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  suggestionPhone: {
    fontSize: 14,
    color: '#666',
  },
});
