import AsyncStorage from '@react-native-async-storage/async-storage';
import {generateUUID} from '../utils/uuid';
import {database} from '../db';

/**
 * Simple Local Authentication Service
 * No JWT, no server - just local storage
 * User creates profile once and it persists until account deletion
 */
class SimpleAuthService {
  constructor() {
    this.currentUser = null;
  }

  // Initialize and check if user exists
  async initialize() {
    try {
      const userDataStr = await AsyncStorage.getItem('local_user_profile');
      
      if (userDataStr) {
        this.currentUser = JSON.parse(userDataStr);
        console.log('✅ User profile loaded:', this.currentUser.name);
        return {
          hasUser: true,
          user: this.currentUser,
        };
      }
      
      console.log('ℹ️  No user profile found');
      return {
        hasUser: false,
        user: null,
      };
    } catch (error) {
      console.error('Error initializing auth:', error);
      return {
        hasUser: false,
        user: null,
      };
    }
  }

  // Create user profile (one-time setup)
  async createUserProfile(profileData) {
    try {
      const {name, email, companyName, location} = profileData;

      if (!name || !companyName) {
        return {
          success: false,
          error: 'Name and Company Name are required',
        };
      }

      const userId = generateUUID();
      const companyCode = companyName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 6) || 'GURU';

      const userProfile = {
        id: userId,
        name: name.trim(),
        email: email?.trim() || '',
        companyName: companyName.trim(),
        companyCode,
        location: location?.trim() || '',
        createdAt: new Date().toISOString(),
      };

      // Save to AsyncStorage
      await AsyncStorage.setItem(
        'local_user_profile',
        JSON.stringify(userProfile)
      );

      // Save company settings to database
      await database.write(async () => {
        const settingsCollection = database.collections.get('settings');
        
        // Clear any existing settings
        const existingSettings = await settingsCollection.query().fetch();
        for (const setting of existingSettings) {
          await setting.markAsDeleted();
        }

        // Create new settings
        await settingsCollection.create(s => {
          s.key = 'userId';
          s.value = userId;
        });
        await settingsCollection.create(s => {
          s.key = 'ownerName';
          s.value = userProfile.name;
        });
        await settingsCollection.create(s => {
          s.key = 'shopName';
          s.value = userProfile.companyName;
        });
        await settingsCollection.create(s => {
          s.key = 'companyCode';
          s.value = companyCode;
        });
        await settingsCollection.create(s => {
          s.key = 'location';
          s.value = userProfile.location;
        });
        await settingsCollection.create(s => {
          s.key = 'hasOnboarded';
          s.value = 'true';
        });
      });

      this.currentUser = userProfile;
      console.log('✅ User profile created:', userProfile.name);

      return {
        success: true,
        user: userProfile,
      };
    } catch (error) {
      console.error('Error creating user profile:', error);
      return {
        success: false,
        error: error.message || 'Failed to create profile',
      };
    }
  }

  // Delete account and all data
  async deleteAccount() {
    try {
      console.log('🗑️  Deleting account and all data...');

      // Delete all data from database
      await database.write(async () => {
        const collections = [
          'items',
          'customers',
          'transactions',
          'transaction_lines',
          'settings',
          'audit_logs',
          'sync_queue',
        ];

        for (const collectionName of collections) {
          try {
            const collection = database.collections.get(collectionName);
            const allRecords = await collection.query().fetch();
            
            for (const record of allRecords) {
              await record.markAsDeleted();
            }
            
            console.log(`Deleted ${allRecords.length} records from ${collectionName}`);
          } catch (error) {
            console.error(`Error deleting ${collectionName}:`, error);
          }
        }
      });

      // Clear AsyncStorage
      await AsyncStorage.multiRemove([
        'local_user_profile',
        'last_sync_time',
        'app_settings',
      ]);

      this.currentUser = null;
      console.log('✅ Account deleted successfully');

      return {
        success: true,
        message: 'Account and all data deleted',
      };
    } catch (error) {
      console.error('Error deleting account:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete account',
      };
    }
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }

  // Get user ID for data ownership
  getUserId() {
    return this.currentUser?.id || null;
  }

  // Get company code for voucher generation
  getCompanyCode() {
    return this.currentUser?.companyCode || 'GURU';
  }
}

export default new SimpleAuthService();
