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
  Dimensions,
} from 'react-native';
import {CameraView, useCameraPermissions} from 'expo-camera';
import {database} from '../db';
import {Q} from '@nozbe/watermelondb';
import {useCart} from '../context/CartContext';
import {formatCurrency} from '../utils/formatters';
import {Ionicons} from '@expo/vector-icons';

const {width, height} = Dimensions.get('window');

export default function ImprovedScannerScreen({navigation}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanQueue, setScanQueue] = useState([]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [newItemData, setNewItemData] = useState({name: '', price: '', unit: 'pcs'});
  const {addToCart, updateQuantity} = useCart();
  
  // Debounce timer
  const debounceTimer = useRef(null);
  const lastScannedCode = useRef('');

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const findItemByBarcode = async (barcode) => {
    try {
      console.log('🔍 Searching for barcode:', barcode);
      const itemsCollection = database.collections.get('items');
      const items = await itemsCollection.query(Q.where('barcode', barcode)).fetch();
      console.log('📦 Found items:', items.length);
      return items.length > 0 ? items[0] : null;
    } catch (error) {
      console.error('Database lookup error:', error);
      return null;
    }
  };

  const handleBarCodeScanned = async ({type, data}) => {
    const trimmedBarcode = data.trim();
    
    // Debounce: ignore if same code scanned within 2 seconds
    if (trimmedBarcode === lastScannedCode.current) {
      console.log('⏱️ Debounce: ignoring duplicate scan');
      return;
    }

    // Clear previous debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set debounce timer
    debounceTimer.current = setTimeout(async () => {
      console.log('📷 Barcode Scanned:', {type, barcode: trimmedBarcode});
      lastScannedCode.current = trimmedBarcode;
      setScanned(true);

      const item = await findItemByBarcode(trimmedBarcode);
      console.log('🔍 Database lookup result:', item ? 'Found' : 'Not found');

      if (item) {
        // Auto-add to cart
        addToCart(item, 1);

        // Update scan queue
        setScanQueue(prev => {
          const existing = prev.find(q => q.itemId === item.id);
          if (existing) {
            return prev.map(q =>
              q.itemId === item.id ? {...q, count: q.count + 1} : q,
            );
          }
          return [...prev, {itemId: item.id, itemName: item.name, count: 1, item}];
        });

        // Reset scanner after 1 second
        setTimeout(() => setScanned(false), 1000);
      } else {
        // Unknown barcode - show manual entry
        setManualBarcode(trimmedBarcode);
        setShowManualEntry(true);
      }
    }, 2000); // 2 second debounce
  };

  const handleManualAdd = async () => {
    if (!newItemData.name || !newItemData.price) {
      Alert.alert('Error', 'Please fill in name and price');
      return;
    }

    try {
      let newItem;
      
      await database.write(async () => {
        const itemsCollection = database.collections.get('items');
        newItem = await itemsCollection.create(item => {
          item.name = newItemData.name;
          item.barcode = manualBarcode;
          item.price = parseFloat(newItemData.price);
          item.unit = newItemData.unit;
          item.category = 'General';
          item.recommended = false;
          item.defaultQuantity = 1;
          item.inventoryQty = 0;
          item.isSynced = false;
        });
      });

      // Add to cart
      addToCart(newItem, 1);

      // Update scan queue
      setScanQueue(prev => [
        ...prev,
        {itemId: newItem.id, itemName: newItem.name, count: 1, item: newItem}
      ]);

      // Reset form
      setNewItemData({name: '', price: '', unit: 'pcs'});
      setManualBarcode('');
      setShowManualEntry(false);
      setScanned(false);

      Alert.alert('Success', 'Item added to cart');
    } catch (error) {
      console.error('Error creating item:', error);
      Alert.alert('Error', 'Failed to create item');
    }
  };

  const updateScanQueueQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      setScanQueue(prev => prev.filter(q => q.itemId !== itemId));
    } else {
      setScanQueue(prev =>
        prev.map(q =>
          q.itemId === itemId ? {...q, count: newQuantity} : q,
        ),
      );
    }
    
    // Update cart
    updateQuantity(itemId, newQuantity);
  };

  const goToCounter = () => {
    navigation.navigate('Counter');
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color="#6B46C1" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan barcodes
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'pdf417', 'upc_e', 'upc_a', 'ean13', 'ean8', 'code128', 'code39'],
        }}
      />
      
      {/* Fixed Scanner Frame */}
      <View style={styles.scannerOverlay}>
        <View style={styles.scannerFrame}>
          <View style={styles.corner} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Barcode</Text>
        <TouchableOpacity onPress={() => setShowManualEntry(true)} style={styles.manualButton}>
          <Ionicons name="create-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Scan Queue */}
      {scanQueue.length > 0 && (
        <View style={styles.scanQueue}>
          <Text style={styles.scanQueueTitle}>Scanned Items</Text>
          <FlatList
            data={scanQueue}
            keyExtractor={item => item.itemId}
            renderItem={({item}) => (
              <View style={styles.scanQueueItem}>
                <View style={styles.scanQueueItemInfo}>
                  <Text style={styles.scanQueueItemName}>{item.itemName}</Text>
                  <Text style={styles.scanQueueItemPrice}>
                    {formatCurrency(item.item.price)}
                  </Text>
                </View>
                <View style={styles.scanQueueControls}>
                  <TouchableOpacity
                    style={styles.scanQueueButton}
                    onPress={() => updateScanQueueQuantity(item.itemId, item.count - 1)}>
                    <Ionicons name="remove" size={16} color="#6B46C1" />
                  </TouchableOpacity>
                  <Text style={styles.scanQueueCount}>{item.count}</Text>
                  <TouchableOpacity
                    style={styles.scanQueueButton}
                    onPress={() => updateScanQueueQuantity(item.itemId, item.count + 1)}>
                    <Ionicons name="add" size={16} color="#6B46C1" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          <TouchableOpacity style={styles.goToCounterButton} onPress={goToCounter}>
            <Text style={styles.goToCounterButtonText}>
              Go to Counter ({scanQueue.reduce((sum, item) => sum + item.count, 0)} items)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual Entry Modal */}
      <Modal visible={showManualEntry} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Item</Text>
              <TouchableOpacity onPress={() => setShowManualEntry(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Barcode</Text>
                <TextInput
                  style={styles.input}
                  value={manualBarcode}
                  onChangeText={setManualBarcode}
                  placeholder="Enter barcode"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Item Name *</Text>
                <TextInput
                  style={styles.input}
                  value={newItemData.name}
                  onChangeText={text => setNewItemData({...newItemData, name: text})}
                  placeholder="Enter item name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price *</Text>
                <TextInput
                  style={styles.input}
                  value={newItemData.price}
                  onChangeText={text => setNewItemData({...newItemData, price: text})}
                  placeholder="Enter price"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Unit</Text>
                <View style={styles.unitChips}>
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
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowManualEntry(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addButton} onPress={handleManualAdd}>
                <Text style={styles.addButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  scannerFrame: {
    width: width * 0.7,
    height: width * 0.7,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: '#6B46C1',
    top: 0,
    left: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    left: 'auto',
    borderLeftWidth: 0,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    top: 'auto',
    borderTopWidth: 0,
    borderBottomWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    top: 'auto',
    left: 'auto',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  manualButton: {
    padding: 8,
  },
  scanQueue: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: height * 0.4,
  },
  scanQueueTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  scanQueueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  scanQueueItemInfo: {
    flex: 1,
  },
  scanQueueItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  scanQueueItemPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  scanQueueControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanQueueButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanQueueCount: {
    marginHorizontal: 15,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  goToCounterButton: {
    backgroundColor: '#6B46C1',
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
    alignItems: 'center',
  },
  goToCounterButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#6B46C1',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
  },
  unitChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  unitChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 10,
    marginBottom: 10,
  },
  unitChipSelected: {
    backgroundColor: '#6B46C1',
  },
  unitChipText: {
    fontSize: 14,
    color: '#666',
  },
  unitChipTextSelected: {
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  addButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#6B46C1',
  },
  addButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});