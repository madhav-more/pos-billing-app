import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple storage wrapper using AsyncStorage
class SimpleStorage {
  async getItems() {
    try {
      const data = await AsyncStorage.getItem('items');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting items:', error);
      return [];
    }
  }

  async getItem(id) {
    const items = await this.getItems();
    return items.find(item => item.id === id);
  }

  async saveItem(item) {
    const items = await this.getItems();
    const existing = items.findIndex(i => i.id === item.id);
    
    if (existing >= 0) {
      items[existing] = item;
    } else {
      items.push(item);
    }
    
    await AsyncStorage.setItem('items', JSON.stringify(items));
    return item;
  }

  async getTransactions() {
    try {
      const data = await AsyncStorage.getItem('transactions');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting transactions:', error);
      return [];
    }
  }

  async saveTransaction(transaction) {
    const transactions = await this.getTransactions();
    transactions.push(transaction);
    await AsyncStorage.setItem('transactions', JSON.stringify(transactions));
    return transaction;
  }

  async getSettings() {
    try {
      const data = await AsyncStorage.getItem('settings');
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting settings:', error);
      return {};
    }
  }

  async saveSetting(key, value) {
    const settings = await this.getSettings();
    settings[key] = value;
    await AsyncStorage.setItem('settings', JSON.stringify(settings));
  }

  async getSetting(key) {
    const settings = await this.getSettings();
    return settings[key];
  }
}

export const storage = new SimpleStorage();
