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
  Animated,
  Platform,
} from 'react-native';
import {CameraView, useCameraPermissions} from 'expo-camera';
import {database} from '../db';
import {Q} from '@nozbe/watermelondb';
import {useCart} from '../context/CartContext';
import {formatCurrency} from '../utils/formatters';
import {Ionicons} from '@expo/vector-icons';
// optional haptics (wrapped to avoid crash on unsupported platforms)
let Haptics;
try {
  // lazy require so it won't crash if module isn't installed
  // If you don't have expo-haptics installed remove this block or install it.
  // keep optional — failure to import will be caught and ignored
  // eslint-disable-next-line global-require
  Haptics = require('expo-haptics');
} catch (e) {
  Haptics = null;
}

const {width, height} = Dimensions.get('window');

export default function ImprovedScannerScreen({navigation}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanQueue, setScanQueue] = useState([]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [newItemData, setNewItemData] = useState({name: '', price: '', unit: 'pcs'});
  const [cameraReady, setCameraReady] = useState(false);
  const {addToCart, updateQuantity} = useCart();

  // Debounce & cooldown timer refs
  const debounceTimer = useRef(null);         // prevents events during debounce window
  const lastScannedCode = useRef('');        // keep track of last scanned barcode
  const cooldownTimer = useRef(null);        // for cooldown when re-enabling same barcode

  // Pulsing animation for center guide
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Flash animation for quick visual feedback on successful scan
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // request permission immediately so camera can initialize faster
    // Only request if we don't already have a response (keeps behavior safe)
    if (!permission) {
      requestPermission().catch(err => console.warn('Permission request failed', err));
    } else if (!permission.granted) {
      // if permission object exists but not granted, proactively request
      requestPermission().catch(err => console.warn('Permission request failed', err));
    }

    // Start pulsing animation for the guide
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => {
      pulse.stop();
      // clear any timers on unmount
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      if (cooldownTimer.current) {
        clearTimeout(cooldownTimer.current);
        cooldownTimer.current = null;
      }
      flashAnim.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Small helper to flash screen briefly for visual feedback
  const triggerFlashAndHaptics = () => {
    // flash animation
    Animated.sequence([
      Animated.timing(flashAnim, {toValue: 0.35, duration: 60, useNativeDriver: true}),
      Animated.timing(flashAnim, {toValue: 0, duration: 200, useNativeDriver: true}),
    ]).start();
    // haptic feedback (optional)
    try {
      if (Haptics && Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      // ignore haptics failures
    }
  };

  const handleBarCodeScanned = async ({type, data}) => {
    // If data is falsy, ignore
    if (!data) return;
    const trimmedBarcode = data.trim();

    // If currently debouncing (global), ignore this event
    if (debounceTimer.current) {
      // quick exit to avoid double processing of rapid events
      return;
    }

    // Prevent duplicate scans of same code while in cooldown
    if (scanned || trimmedBarcode === lastScannedCode.current) {
      return;
    }

    console.log('📷 Barcode Scanned:', {type, barcode: trimmedBarcode});

    // Start a short debounce window so multiple camera events in quick succession are ignored
    debounceTimer.current = setTimeout(() => {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }, 300); // small debounce to swallow immediate duplicated camera events

    // Mark scanned and remember last code
    lastScannedCode.current = trimmedBarcode;
    setScanned(true);

    // Visual & haptic feedback
    triggerFlashAndHaptics();

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

      // Keep scanned true briefly to avoid double-adds (slightly longer cooldown than before)
      // This is the "light delay" you asked for before allowing the next scan of the same item.
      // We keep this small so the scanner still feels snappy but won't double-trigger.
      if (cooldownTimer.current) {
        clearTimeout(cooldownTimer.current);
        cooldownTimer.current = null;
      }
      cooldownTimer.current = setTimeout(() => {
        setScanned(false);
        lastScannedCode.current = '';
        cooldownTimer.current = null;
      }, 800); // increased from 300ms -> 800ms to reduce accidental double-scans
    } else {
      // Unknown barcode - show manual entry
      setManualBarcode(trimmedBarcode);
      setShowManualEntry(true);

      // allow the scanner to resume quickly so user can enter details
      // keep a short lock to avoid immediate duplicates while user sees modal
      setTimeout(() => {
        setScanned(false);
        lastScannedCode.current = '';
      }, 300);
    }
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
        onCameraReady={() => {
          // cameraReady fast path
          setCameraReady(true);
        }}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'pdf417', 'upc_e', 'upc_a', 'ean13', 'ean8', 'code128', 'code39'],
        }}
      />

      {/* Flash overlay for quick feedback */}
      <Animated.View pointerEvents="none" style={[styles.flashOverlay, {opacity: flashAnim}]} />

      {/* Camera Loading Indicator */}
      {!cameraReady && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Initializing camera...</Text>
        </View>
      )}

      {/* Fixed Scanner Frame */}
      <View style={styles.scannerOverlay}>
        <View style={styles.scannerFrame}>
          <View style={styles.corner} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />

          {/* Pulsing center guide dot */}
          <Animated.View
            style={[
              styles.centerGuide,
              {
                transform: [{scale: pulseAnim}],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [0.8, 0.4],
                }),
              },
            ]}
          />
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
  centerGuide: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6B46C1',
    top: '50%',
    left: '50%',
    marginTop: -6,
    marginLeft: -6,
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Platform.OS === 'ios' ? '#fff' : '#fff',
    zIndex: 50,
  },
});
