import React, {createContext, useContext, useState, useCallback, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {calculateLineTotal, calculateTransactionTotals} from '../utils/calculations';

const CartContext = createContext();

export function CartProvider({children}) {
  const [cartLines, setCartLines] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from storage on mount
  useEffect(() => {
    loadCart();
  }, []);

  // Save cart to storage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      saveCart();
    }
  }, [cartLines, isLoaded]);

  const loadCart = async () => {
    try {
      const savedCart = await AsyncStorage.getItem('cart_data');
      if (savedCart) {
        setCartLines(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveCart = async () => {
    try {
      await AsyncStorage.setItem('cart_data', JSON.stringify(cartLines));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const addToCart = useCallback((item, quantity = 1) => {
    setCartLines(prev => {
      const existing = prev.find(line => line.itemId === item.id);
      
      if (existing) {
        return prev.map(line =>
          line.itemId === item.id
            ? {
                ...line,
                quantity: line.quantity + quantity,
                lineTotal: calculateLineTotal(
                  line.quantity + quantity,
                  line.unitPrice,
                  line.perLineDiscount,
                ),
              }
            : line,
        );
      }

      return [
        ...prev,
        {
          itemId: item.id,
          itemName: item.name,
          quantity,
          unitPrice: item.price,
          unit: item.unit,
          perLineDiscount: 0,
          lineTotal: calculateLineTotal(quantity, item.price, 0),
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback(itemId => {
    setCartLines(prev => prev.filter(line => line.itemId !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCartLines(prev =>
      prev.map(line =>
        line.itemId === itemId
          ? {
              ...line,
              quantity: newQuantity,
              lineTotal: calculateLineTotal(newQuantity, line.unitPrice, line.perLineDiscount),
            }
          : line,
      ),
    );
  }, [removeFromCart]);

  const updateLineDiscount = useCallback((itemId, discount) => {
    setCartLines(prev =>
      prev.map(line =>
        line.itemId === itemId
          ? {
              ...line,
              perLineDiscount: discount,
              lineTotal: calculateLineTotal(line.quantity, line.unitPrice, discount),
            }
          : line,
      ),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartLines([]);
  }, []);

  const getTotals = useCallback(
    (taxPercent = 0, discount = 0, otherCharges = 0) => {
      return calculateTransactionTotals(cartLines, taxPercent, discount, otherCharges);
    },
    [cartLines],
  );

  return (
    <CartContext.Provider
      value={{
        cartLines,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateLineDiscount,
        clearCart,
        getTotals,
      }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
