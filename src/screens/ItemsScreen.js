import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import {database} from '../db';
import {syncItemsToCloud} from '../services/cloudSyncService';
import {generateUUID} from '../utils/uuid';
import simpleAuthService from '../services/simpleAuthService';

export default function ItemsScreen() {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: 'piece',
    pricingMode: 'simple',
    price: '',
    costPrice: '',
    mrp: '',
    minStock: '',
    currentStock: '',
  });

  useEffect(() => {
    // Use WatermelonDB observable for live updates
    const itemsCollection = database.collections.get('items');
    const subscription = itemsCollection.query().observe().subscribe(allItems => {
      setItems(allItems);
      console.log('📦 Items updated (live):', allItems.length);
    });

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, []);

  const filteredItems = searchQuery
    ? items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  const handleCreateItem = async () => {
    if (!formData.name || !formData.category || !formData.price) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const price = parseFloat(formData.price);
      if (isNaN(price) || price < 0) {
        Alert.alert('Error', 'Please enter a valid price');
        return;
      }

      await database.write(async () => {
        const itemsCollection = database.collections.get('items');
        
        if (editingItem) {
          await editingItem.update(item => {
            item.name = formData.name.trim();
            item.category = formData.category.trim();
            item.unit = formData.unit || 'piece';
            item.price = price;
            item.costPrice = formData.costPrice ? parseFloat(formData.costPrice) : 0;
            item.mrp = formData.mrp ? parseFloat(formData.mrp) : 0;
            item.minStock = formData.minStock ? parseInt(formData.minStock) : 0;
            item.inventoryQty = formData.currentStock ? parseInt(formData.currentStock) : 0;
            item.recommended = item.recommended || false;
            item.defaultQuantity = 1;
            item.isSynced = false;
            item.syncStatus = 'pending';
          });
        } else {
          const localId = generateUUID();
          const idempotencyKey = generateUUID();
          const currentUser = simpleAuthService.getCurrentUser();
          
          await itemsCollection.create(item => {
            item.localId = localId;
            item.idempotencyKey = idempotencyKey;
            item.name = formData.name.trim();
            item.category = formData.category.trim();
            item.unit = formData.unit || 'piece';
            item.price = price;
            item.costPrice = formData.costPrice ? parseFloat(formData.costPrice) : 0;
            item.mrp = formData.mrp ? parseFloat(formData.mrp) : 0;
            item.minStock = formData.minStock ? parseInt(formData.minStock) : 0;
            item.inventoryQty = formData.currentStock ? parseInt(formData.currentStock) : 0;
            item.recommended = false;
            item.defaultQuantity = 1;
            item.isSynced = false;
            item.syncStatus = 'pending';
            item.cloudId = null;
            item.userId = currentUser?.id || null;
          });
        }
      });

      closeModal();
      Alert.alert('Success', editingItem ? 'Item updated' : 'Item created');
      
      // Sync to cloud in background
      syncItemsToCloud().catch(err => console.log('Sync skipped:', err.message));
    } catch (error) {
      console.error('Error saving item:', error);
      console.error('Error stack:', error.stack);
      Alert.alert('Error', `Failed to save item: ${error.message}`);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category || '',
      unit: item.unit || 'piece',
      pricingMode: 'simple',
      price: item.price?.toString() || '',
      costPrice: item.costPrice?.toString() || '',
      mrp: item.mrp?.toString() || '',
      minStock: item.minStock?.toString() || '',
      currentStock: item.inventoryQty?.toString() || '0',
    });
    setModalVisible(true);
  };

  const handleDeleteItem = async (item) => {
    Alert.alert(
      'Delete Item',
      `Delete "${item.name}"?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.write(async () => {
                await item.markAsDeleted();
              });
              // Observable will auto-update the list
            } catch (error) {
              console.error('Error deleting item:', error);
            }
          },
        },
      ]
    );
  };

  const openModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: '',
      unit: 'piece',
      pricingMode: 'simple',
      price: '',
      costPrice: '',
      mrp: '',
      minStock: '',
      currentStock: '',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingItem(null);
  };

  const renderItem = ({item}) => {
    const stock = item.inventoryQty || 0;
    const isLowStock = stock > 0 && stock <= 10;
    const isOutOfStock = stock === 0;
    
    return (
    <View style={styles.itemCard}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemCategory}>{item.category}</Text>
        <Text style={styles.itemPrice}>₹{item.price?.toFixed(2)} / {item.unit}</Text>
        <View style={styles.stockRow}>
          <Text style={[
            styles.itemStock,
            isOutOfStock && styles.stockOut,
            isLowStock && styles.stockLow
          ]}>
            {isOutOfStock ? '🔴' : isLowStock ? '🟡' : '🟢'} Stock: {stock}
          </Text>
          {!item.isSynced && (
            <Text style={styles.syncBadge}>🔄 Pending</Text>
          )}
        </View>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity style={styles.editButton} onPress={() => handleEditItem(item)}>
          <Text style={styles.actionButtonText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteItem(item)}>
          <Text style={styles.actionButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Items & Inventory</Text>
      </View>

      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.addButton} onPress={openModal}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items yet</Text>
            <Text style={styles.emptySubtext}>Tap "+ Add" to create your first item</Text>
          </View>
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Item' : 'Create Item'}</Text>

              <Text style={styles.label}>Item Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Coca Cola"
                value={formData.name}
                onChangeText={text => setFormData({...formData, name: text})}
              />

              <Text style={styles.label}>Category *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Beverages"
                value={formData.category}
                onChangeText={text => setFormData({...formData, category: text})}
              />

              <Text style={styles.label}>Sell By</Text>
              <View style={styles.unitSelector}>
                {['piece', 'kg', 'gram', 'liter', 'ml'].map(unit => (
                  <TouchableOpacity
                    key={unit}
                    style={[styles.unitButton, formData.unit === unit && styles.unitButtonActive]}
                    onPress={() => setFormData({...formData, unit})}>
                    <Text style={[styles.unitButtonText, formData.unit === unit && styles.unitButtonTextActive]}>
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Selling Price * (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={formData.price}
                onChangeText={text => setFormData({...formData, price: text})}
              />

              <Text style={styles.sectionTitle}>Advanced (Optional)</Text>

              <Text style={styles.label}>Cost Price (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={formData.costPrice}
                onChangeText={text => setFormData({...formData, costPrice: text})}
              />

              <Text style={styles.label}>MRP (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={formData.mrp}
                onChangeText={text => setFormData({...formData, mrp: text})}
              />

              <Text style={styles.label}>Current Stock</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="number-pad"
                value={formData.currentStock}
                onChangeText={text => setFormData({...formData, currentStock: text})}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleCreateItem}>
                  <Text style={styles.saveButtonText}>{editingItem ? 'Update' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F5F5'},
  header: {backgroundColor: '#6B46C1', padding: 16, paddingTop: 48},
  title: {fontSize: 24, fontWeight: 'bold', color: '#FFFFFF'},
  searchSection: {backgroundColor: '#FFFFFF', padding: 12, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E0E0E0'},
  searchInput: {flex: 1, backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8, fontSize: 16, marginRight: 12},
  addButton: {backgroundColor: '#6B46C1', padding: 12, borderRadius: 8},
  addButtonText: {color: '#FFFFFF', fontWeight: 'bold'},
  listContainer: {padding: 16},
  itemCard: {backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4},
  itemInfo: {flex: 1},
  itemName: {fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4},
  itemCategory: {fontSize: 14, color: '#999', marginBottom: 4},
  itemPrice: {fontSize: 16, fontWeight: 'bold', color: '#6B46C1', marginBottom: 4},
  itemStock: {fontSize: 12, color: '#666'},
  stockRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4},
  stockOut: {color: '#DC2626', fontWeight: '600'},
  stockLow: {color: '#F59E0B', fontWeight: '600'},
  syncBadge: {fontSize: 10, color: '#6B46C1', backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4},
  itemActions: {flexDirection: 'row', gap: 8},
  editButton: {padding: 8},
  deleteButton: {padding: 8},
  actionButtonText: {fontSize: 20},
  emptyContainer: {alignItems: 'center', paddingTop: 60},
  emptyText: {fontSize: 18, color: '#999', marginBottom: 8},
  emptySubtext: {fontSize: 14, color: '#CCC'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16},
  modalContent: {backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, maxHeight: '90%'},
  modalTitle: {fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 20},
  sectionTitle: {fontSize: 16, fontWeight: '600', color: '#666', marginTop: 16, marginBottom: 12},
  label: {fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8},
  input: {borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16},
  unitSelector: {flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8},
  unitButton: {paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#F5F5F5'},
  unitButtonActive: {backgroundColor: '#6B46C1', borderColor: '#6B46C1'},
  unitButtonText: {fontSize: 14, color: '#666'},
  unitButtonTextActive: {color: '#FFFFFF', fontWeight: 'bold'},
  modalActions: {flexDirection: 'row', gap: 12, marginTop: 24},
  modalButton: {flex: 1, padding: 16, borderRadius: 8, alignItems: 'center'},
  cancelButton: {backgroundColor: '#F5F5F5'},
  cancelButtonText: {color: '#666', fontWeight: 'bold'},
  saveButton: {backgroundColor: '#6B46C1'},
  saveButtonText: {color: '#FFFFFF', fontWeight: 'bold'},
});
