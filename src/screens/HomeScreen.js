import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, TextInput} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {database} from '../db';
import {useCart} from '../context/CartContext';
import {formatCurrency} from '../utils/formatters';

export default function HomeScreen({navigation}) {
  const [items, setItems] = useState([]);
  const [recommendedItems, setRecommendedItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const {cartLines, addToCart, getTotals} = useCart();

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const itemsCollection = database.collections.get('items');
      const allItems = await itemsCollection.query().fetch();
      setItems(allItems);
      const recommended = allItems.filter(item => item.recommended === true);
      setRecommendedItems(recommended);
    } catch (error) {
      console.error('Error loading items:', error);
      setItems([]);
      setRecommendedItems([]);
    }
  };

  const filteredItems = searchQuery
    ? items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : items;

  const filteredRecommended = searchQuery
    ? recommendedItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : recommendedItems;

  const totals = getTotals();

  const renderCartItem = ({item}) => (
    <View style={styles.cartItemRow}>
      <View style={styles.cartItemLeft}>
        <View style={styles.itemThumbnail}>
          <Text style={styles.thumbnailText}>🛒</Text>
        </View>
        <Text style={styles.cartItemName}>{item.itemName}</Text>
      </View>
      
      <Text style={styles.cartItemQty}>{item.quantity}</Text>
      
      <View style={styles.cartItemRight}>
        <Text style={styles.cartItemPrice}>{formatCurrency(item.lineTotal)}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Counter')}>
          <Text style={styles.editIcon}>✏️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRecommendedItem = ({item}) => (
    <TouchableOpacity style={styles.recommendedCard} onPress={() => addToCart(item)}>
      <View style={styles.recommendedThumbnail}>
        <Text style={styles.recommendedEmoji}>🛍️</Text>
      </View>
      <Text style={styles.recommendedName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.recommendedPrice}>{formatCurrency(item.price)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#5B3A8F', '#6B46C1', '#7B52D1']}
        style={styles.gradient}
        start={{x: 0, y: 0}}
        end={{x: 0, y: 1}}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>G.U.R.U</Text>
          <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('More')}>
            <Text style={styles.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* Main White Card */}
        <View style={styles.whiteCard}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search items..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* Items Added Section */}
            {cartLines.length > 0 && (
              <View style={styles.cartSection}>
                <FlatList
                  data={cartLines}
                  renderItem={renderCartItem}
                  keyExtractor={item => item.itemId}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => navigation.navigate('SelectItem')}>
                <Text style={styles.addButtonText}>Add Item to Bill</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => navigation.navigate('Scanner')}>
                <Text style={styles.scanButtonIcon}>📷</Text>
                <Text style={styles.scanButtonText}>Scan Barcode</Text>
              </TouchableOpacity>
            </View>

            {/* All Items Section */}
            {(searchQuery || items.length > 0) && (
              <View style={styles.recommendedSection}>
                <Text style={styles.recommendedTitle}>
                  {searchQuery ? 'Search Results' : 'All Items'}
                </Text>
                <FlatList
                  data={searchQuery ? filteredItems : items}
                  renderItem={renderRecommendedItem}
                  keyExtractor={item => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recommendedScroll}
                />
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </View>

        {/* Total Amount Bar */}
        {cartLines.length > 0 && (
          <TouchableOpacity
            style={styles.totalBar}
            onPress={() => navigation.navigate('Counter')}>
            <Text style={styles.totalAmount}>{formatCurrency(totals.grandTotal)}</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  gradient: {flex: 1},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  logo: {fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: 3},
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIcon: {fontSize: 22},
  whiteCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 20,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  scrollContent: {flex: 1, paddingHorizontal: 20},
  cartSection: {marginBottom: 20},
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  cartItemLeft: {flexDirection: 'row', alignItems: 'center', flex: 1},
  itemThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  thumbnailText: {fontSize: 24},
  cartItemName: {fontSize: 15, fontWeight: '500', color: '#333', flex: 1},
  cartItemQty: {fontSize: 16, fontWeight: '600', color: '#666', marginHorizontal: 16},
  cartItemRight: {flexDirection: 'row', alignItems: 'center'},
  cartItemPrice: {fontSize: 16, fontWeight: 'bold', color: '#333', marginRight: 12},
  editIcon: {fontSize: 18},
  separator: {height: 1, backgroundColor: '#F0F0F0', marginVertical: 4},
  actionButtons: {flexDirection: 'row', marginBottom: 24, gap: 12},
  addButton: {
    flex: 1,
    backgroundColor: '#6B46C1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {color: '#FFFFFF', fontSize: 14, fontWeight: 'bold'},
  scanButton: {
    flex: 1,
    backgroundColor: '#5B3A8F',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonIcon: {fontSize: 16, color: '#FFFFFF', marginRight: 8},
  scanButtonText: {color: '#FFFFFF', fontSize: 14, fontWeight: 'bold'},
  recommendedSection: {marginBottom: 24},
  recommendedTitle: {fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16},
  recommendedScroll: {paddingRight: 20},
  recommendedCard: {
    width: 120,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
  },
  recommendedThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E9D8FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendedEmoji: {fontSize: 28},
  recommendedName: {fontSize: 12, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 4, height: 32},
  recommendedPrice: {fontSize: 14, fontWeight: 'bold', color: '#6B46C1'},
  bottomSpacer: {height: 120},
  totalBar: {
    backgroundColor: '#6B46C1',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginBottom: -1,
  },
  totalAmount: {fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center'},
});
