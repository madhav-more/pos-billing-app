import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  Animated,
} from 'react-native';
import {CameraView, useCameraPermissions} from 'expo-camera';
import {database} from '../db';
import {Q} from '@nozbe/watermelondb';
import {useCart} from '../context/CartContext';
import {formatCurrency} from '../utils/formatters';
import {syncItemsToCloud} from '../services/cloudSyncService';

export default function ScannerScreen({navigation}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanQueue, setScanQueue] = useState([]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [newItemData, setNewItemData] = useState({name: '', price: '', unit: 'pcs'});
  const {addToCart} = useCart();
  
  // Animated scanning line
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate scanning line continuously
    const animate = () => {
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]).start(() => animate());
    };
    animate();
  }, []);

  const findItemByBarcode = async barcode => {
    try {
      console.log('🔍 Searching for barcode:', barcode);
      const itemsCollection = database.collections.get('items');
      const items = await itemsCollection.query(Q.where('barcode', barcode)).fetch();
      console.log('📦 Found items:', items.length);
      return items.length > 0 ? items[0] : null;
    } catch (error) {
      console.error('❌ Error finding item:', error);
      return null;
    }
  };

  const handleBarCodeScanned = async ({type, data}) => {
    // Trim whitespace from barcode
    const trimmedBarcode = data.trim();
    console.log('📷 Barcode Scanned:', {type, original: data, trimmed: trimmedBarcode});
    setScanned(true);

    const item = await findItemByBarcode(trimmedBarcode);
    console.log('🔍 Database lookup result:', item ? 'Found' : 'Not found');

    if (item) {
      // Add to scan queue
      setScanQueue(prev => {
        const existing = prev.find(q => q.itemId === item.id);
        if (existing) {
          return prev.map(q =>
            q.itemId === item.id ? {...q, count: q.count + 1} : q,
          );
        }
        return [...prev, {itemId: item.id, itemName: item.name, count: 1, item}];
      });

      // Auto add to cart
      addToCart(item, 1);

      // Reset scanner after 500ms
      setTimeout(() => setScanned(false), 500);
    } else {
      // Unknown barcode - show manual entry
      setManualBarcode(trimmedBarcode);
      setShowManualEntry(true);
    }
  };

  const handleManualAdd = async () => {
    if (!newItemData.name || !newItemData.price) {
      Alert.alert('Error', 'Please fill in item name and price');
      return;
    }

    try {
      console.log('💾 Creating new item with barcode:', manualBarcode);
      console.log('📝 Item data:', newItemData);
      
      let createdItem;
      await database.write(async () => {
        const itemsCollection = database.collections.get('items');
        createdItem = await itemsCollection.create(item => {
          item.name = newItemData.name;
          item.barcode = manualBarcode;
          item.price = parseFloat(newItemData.price);
          item.unit = newItemData.unit;
          item.category = 'Manual';
          item.recommended = false;
          item.defaultQuantity = 1;
        });
        console.log('✅ Item created with ID:', createdItem.id);
      });
      
      // Verify it was saved
      const verification = await findItemByBarcode(manualBarcode);
      console.log('✔️ Verification - Item in database:', verification ? 'YES' : 'NO');

      // Add to cart after database write
      addToCart(createdItem, 1);
      
      // Add to scan queue for visual feedback
      setScanQueue(prev => [...prev, {
        itemId: createdItem.id,
        itemName: createdItem.name,
        count: 1,
        item: createdItem
      }]);

      // Sync to cloud in background
      syncItemsToCloud().catch(err => console.log('Cloud sync skipped:', err));

      setShowManualEntry(false);
      setNewItemData({name: '', price: '', unit: 'pcs'});
      setScanned(false);
      
      // Show success without blocking
      setTimeout(() => {
        Alert.alert('Success', 'Item added to catalog, cart, and inventory!');
      }, 100);
    } catch (error) {
      console.error('Error creating item:', error);
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const goToCounter = () => {
    navigation.navigate('Counter');
  };

  if (!permission) {
    return <View style={styles.container}><Text style={styles.whiteText}>Requesting camera permission...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.whiteText}>Camera permission denied</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.manualButton}
          onPress={() => setShowManualEntry(true)}>
          <Text style={styles.buttonText}>Enter Barcode Manually</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕ Close</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Scan Barcode</Text>
        <TouchableOpacity onPress={() => setShowManualEntry(true)}>
          <Text style={styles.manualText}>Manual</Text>
        </TouchableOpacity>
      </View>

      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'code93', 'upc_a', 'upc_e'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View style={styles.scanFrame}>
        <Animated.View
          style={[
            styles.scanLine,
            {
              transform: [
                {
                  translateY: scanLineAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 250],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      {scanQueue.length > 0 && (
        <View style={styles.queueContainer}>
          <FlatList
            data={scanQueue}
            keyExtractor={item => item.itemId}
            renderItem={({item}) => (
              <View style={styles.queueItem}>
                <Text style={styles.queueItemName}>{item.itemName}</Text>
                <Text style={styles.queueItemCount}>x{item.count}</Text>
              </View>
            )}
          />
          <TouchableOpacity style={styles.goToCounterButton} onPress={goToCounter}>
            <Text style={styles.goToCounterText}>
              GO TO COUNTER ({scanQueue.reduce((acc, q) => acc + q.count, 0)} ITEMS)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showManualEntry} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <ScrollView 
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Item: Scan Success!</Text>
                <Text style={styles.modalSubtitle}>Barcode: {manualBarcode}</Text>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.labelText}>Item Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter item name"
                  value={newItemData.name}
                  autoFocus
                  onChangeText={text => setNewItemData({...newItemData, name: text})}
                />

                <Text style={styles.labelText}>Price (₹) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={newItemData.price}
                  keyboardType="decimal-pad"
                  onChangeText={text => setNewItemData({...newItemData, price: text})}
                />

                <Text style={styles.labelText}>Unit *</Text>
                <View style={styles.unitSelector}>
                  {['pcs', 'kg', 'liter', 'gm', 'ml'].map(unit => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.unitChip,
                        newItemData.unit === unit && styles.unitChipSelected,
                      ]}
                      onPress={() => setNewItemData({...newItemData, unit})}>
                      <Text
                        style={[
                          styles.unitChipText,
                          newItemData.unit === unit && styles.unitChipTextSelected,
                        ]}>
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => {
                    setShowManualEntry(false);
                    setScanned(false);
                    setNewItemData({name: '', price: '', unit: 'pcs'});
                  }}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.addButton} 
                  onPress={handleManualAdd}>
                  <Text style={styles.addButtonText}>Add Item</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  closeButton: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 16,
  },
  manualText: {
    color: '#FFFFFF',
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  whiteText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  manualButton: {
    backgroundColor: '#6B46C1',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scanFrame: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    height: 250,
    borderWidth: 3,
    borderColor: '#FF0000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF0000',
    shadowColor: '#FF0000',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  queueContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 16,
    maxHeight: '40%',
  },
  queueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  queueItemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  queueItemCount: {
    fontSize: 14,
    color: '#6B46C1',
    fontWeight: 'bold',
  },
  goToCounterButton: {
    backgroundColor: '#6B46C1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  goToCounterText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  formSection: {
    padding: 24,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  unitSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  unitChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFFFFF',
  },
  unitChipSelected: {
    backgroundColor: '#6B46C1',
    borderColor: '#6B46C1',
  },
  unitChipText: {
    fontSize: 14,
    color: '#666',
  },
  unitChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#DDD',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  addButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#6B46C1',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
