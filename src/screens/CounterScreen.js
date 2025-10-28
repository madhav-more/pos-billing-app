import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import {useCart} from '../context/CartContext';
import {formatCurrency} from '../utils/formatters';
import {generatePDF} from '../services/exportService';
import {syncTransactionsToCloud} from '../services/cloudSyncService';
import {database} from '../db';

export default function CounterScreen({navigation}) {
  const {cartLines, updateQuantity, updateLineDiscount, clearCart, getTotals, removeFromCart} =
    useCart();
  const [taxPercent, setTaxPercent] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [otherCharges, setOtherCharges] = useState('0');

  const totals = getTotals(
    parseFloat(taxPercent) || 0,
    parseFloat(discount) || 0,
    parseFloat(otherCharges) || 0,
  );

  const handleCharge = async () => {
    if (cartLines.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }

    try {
      let transactionId;
      let savedLines;

      await database.write(async () => {
        const transactionsCollection = database.collections.get('transactions');
        const transactionLinesCollection = database.collections.get('transaction_lines');
        const settingsCollection = database.collections.get('settings');

        // Create transaction
        const transaction = await transactionsCollection.create(txn => {
          txn.date = new Date().toISOString();
          txn.subtotal = totals.subtotal;
          txn.tax = totals.tax;
          txn.discount = totals.discount;
          txn.otherCharges = totals.otherCharges;
          txn.grandTotal = totals.grandTotal;
          txn.itemCount = totals.itemCount;
          txn.unitCount = totals.unitCount;
          txn.status = 'completed';
        });

        transactionId = transaction.id;

        // Create transaction lines
        savedLines = await Promise.all(
          cartLines.map(line =>
            transactionLinesCollection.create(txnLine => {
              txnLine.transactionId = transaction.id;
              txnLine.itemId = line.itemId;
              txnLine.itemName = line.itemName;
              txnLine.quantity = line.quantity;
              txnLine.unitPrice = line.unitPrice;
              txnLine.perLineDiscount = line.perLineDiscount;
              txnLine.lineTotal = line.lineTotal;
            }),
          ),
        );

        // Get shop info for receipt
        const settings = await settingsCollection.query().fetch();
        const shopName = settings.find(s => s.key === 'shopName')?.value || 'G.U.R.U Store';
        const ownerName = settings.find(s => s.key === 'ownerName')?.value || '';
        const location = settings.find(s => s.key === 'location')?.value || '';
      });

      // Generate PDF outside the write block
      try {
        const pdfResult = await generatePDF(
          {
            id: transactionId,
            date: new Date().toISOString(),
            subtotal: totals.subtotal,
            tax: totals.tax,
            discount: totals.discount,
            otherCharges: totals.otherCharges,
            grandTotal: totals.grandTotal,
            itemCount: totals.itemCount,
            unitCount: totals.unitCount,
          },
          savedLines.map(l => ({
            itemName: l.itemName,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            perLineDiscount: l.perLineDiscount,
            lineTotal: l.lineTotal,
          })),
          {shopName, ownerName, location},
        );

        // Update transaction with receipt path
        if (pdfResult.success && transactionId) {
          await database.write(async () => {
            const transactionsCollection = database.collections.get('transactions');
            const txn = await transactionsCollection.find(transactionId);
            await txn.update(t => {
              t.receiptFilePath = pdfResult.path;
            });
          });
        }
      } catch (pdfError) {
        console.log('PDF generation skipped:', pdfError.message);
      }

      // Clear cart
      clearCart();
      setTaxPercent('0');
      setDiscount('0');
      setOtherCharges('0');

      // Sync transaction to cloud in background
      syncTransactionsToCloud().catch(err => console.log('Sync skipped:', err));
      
      // Navigate to receipt preview
      Alert.alert(
        'Success!',
        `Transaction completed!\nReceipt saved to device.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Today'),
          },
        ],
      );
    } catch (error) {
      console.error('Transaction error:', error);
      Alert.alert('Error', 'Failed to complete transaction');
    }
  };

  const handleSaveForLater = async () => {
    if (cartLines.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }

    try {
      await database.write(async () => {
        const transactionsCollection = database.collections.get('transactions');
        const transactionLinesCollection = database.collections.get('transaction_lines');

        const transaction = await transactionsCollection.create(txn => {
          txn.date = new Date().toISOString();
          txn.subtotal = totals.subtotal;
          txn.tax = totals.tax;
          txn.discount = totals.discount;
          txn.otherCharges = totals.otherCharges;
          txn.grandTotal = totals.grandTotal;
          txn.itemCount = totals.itemCount;
          txn.unitCount = totals.unitCount;
          txn.status = 'saved_for_later';
        });

        await Promise.all(
          cartLines.map(line =>
            transactionLinesCollection.create(txnLine => {
              txnLine.transactionId = transaction.id;
              txnLine.itemId = line.itemId;
              txnLine.itemName = line.itemName;
              txnLine.quantity = line.quantity;
              txnLine.unitPrice = line.unitPrice;
              txnLine.perLineDiscount = line.perLineDiscount;
              txnLine.lineTotal = line.lineTotal;
            }),
          ),
        );
      });

      clearCart();
      Alert.alert('Success', 'Transaction saved for later');
      navigation.navigate('Today');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save transaction');
    }
  };

  const handleClear = () => {
    Alert.alert('Clear Cart', 'Are you sure you want to clear the cart?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearCart();
          setTaxPercent('0');
          setDiscount('0');
          setOtherCharges('0');
        },
      },
    ]);
  };

  if (cartLines.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Counter</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>🛒👨‍💼</Text>
          <Text style={styles.emptyMessage}>Couner is free</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Today')}>
            <Text style={styles.backButtonText}>Create a New Sale</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backArrow}>
          <Text style={styles.backArrowText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>G.U.R.U</Text>
        <TouchableOpacity onPress={handleClear}>
          <Text style={styles.clearText}>CLEAR</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {cartLines.map(line => (
          <View key={line.itemId} style={styles.lineItem}>
            <View style={styles.lineHeader}>
              <Text style={styles.itemName}>{line.itemName}</Text>
              <TouchableOpacity onPress={() => removeFromCart(line.itemId)}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.lineDetails}>
              <View style={styles.qtyControl}>
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() => updateQuantity(line.itemId, line.quantity - 1)}>
                  <Text style={styles.qtyButtonText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.qtyInput}
                  value={line.quantity.toString()}
                  keyboardType="decimal-pad"
                  onChangeText={text => updateQuantity(line.itemId, parseFloat(text) || 0)}
                />
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() => updateQuantity(line.itemId, line.quantity + 1)}>
                  <Text style={styles.qtyButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.linePrice}>
                {line.quantity} × {formatCurrency(line.unitPrice)}
              </Text>
              <Text style={styles.lineTotal}>{formatCurrency(line.lineTotal)}</Text>
            </View>
          </View>
        ))}

        <View style={styles.adjustmentsSection}>
          <Text style={styles.sectionTitle}>Adjustments</Text>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Tax %</Text>
            <TextInput
              style={styles.adjustmentInput}
              value={taxPercent}
              keyboardType="decimal-pad"
              onChangeText={setTaxPercent}
              placeholder="0"
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Discount ₹</Text>
            <TextInput
              style={styles.adjustmentInput}
              value={discount}
              keyboardType="decimal-pad"
              onChangeText={setDiscount}
              placeholder="0"
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Other Charges ₹</Text>
            <TextInput
              style={styles.adjustmentInput}
              value={otherCharges}
              keyboardType="decimal-pad"
              onChangeText={setOtherCharges}
              placeholder="0"
            />
          </View>
        </View>

        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(totals.subtotal)}</Text>
          </View>
          {totals.tax > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.tax)}</Text>
            </View>
          )}
          {totals.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={styles.totalValue}>-{formatCurrency(totals.discount)}</Text>
            </View>
          )}
          {totals.otherCharges > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Other Charges</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.otherCharges)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(totals.grandTotal)}</Text>
          </View>
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveForLater}>
          <Text style={styles.saveButtonText}>SAVE FOR LATER</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.chargeButton} onPress={handleCharge}>
          <Text style={styles.chargeButtonText}>CHARGE {formatCurrency(totals.grandTotal)}</Text>
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
  header: {
    backgroundColor: '#6B46C1',
    padding: 16,
    paddingTop: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backArrow: {
    padding: 4,
  },
  backArrowText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 2,
  },
  clearText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyMessage: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#6B46C1',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  lineItem: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  removeText: {
    color: '#FF3B30',
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  lineDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  qtyButton: {
    padding: 8,
    paddingHorizontal: 12,
  },
  qtyButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B46C1',
  },
  qtyInput: {
    width: 50,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linePrice: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    textAlign: 'center',
  },
  lineTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B46C1',
  },
  adjustmentsSection: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
  },
  adjustmentInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 8,
    width: 100,
    textAlign: 'right',
    fontSize: 16,
  },
  totalsSection: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    padding: 16,
    borderRadius: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  grandTotalRow: {
    borderTopWidth: 2,
    borderTopColor: '#6B46C1',
    paddingTop: 12,
    marginTop: 12,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B46C1',
  },
  grandTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6B46C1',
  },
  spacer: {
    height: 150,
  },
  actions: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#E9D8FD',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  saveButtonText: {
    color: '#6B46C1',
    fontSize: 14,
    fontWeight: 'bold',
  },
  chargeButton: {
    flex: 2,
    backgroundColor: '#6B46C1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  chargeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
