import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { v4 as uuidv4 } from 'uuid';

const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';
const TOKEN_EXPIRY_KEY = 'token_expiry';
const OFFLINE_MODE_KEY = 'offline_mode';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * Enhanced JWT Authentication Service with comprehensive offline support
 * Provides token management, offline verification, and secure storage
 */
class EnhancedAuthService {
  constructor() {
    this.token = null;
    this.user = null;
    this.tokenExpiry = null;
    this.isOnline = false;
    this.offlineMode = false;
    this.init();
  }

  async init() {
    try {
      // Load stored authentication data
      const [storedToken, storedUser, storedExpiry, offlineMode] = await Promise.all([
        this.getSecureItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(USER_DATA_KEY),
        AsyncStorage.getItem(TOKEN_EXPIRY_KEY),
        AsyncStorage.getItem(OFFLINE_MODE_KEY)
      ]);

      this.offlineMode = offlineMode === 'true';

      if (storedToken && storedUser) {
        this.token = storedToken;
        this.user = JSON.parse(storedUser);
        this.tokenExpiry = storedExpiry ? parseInt(storedExpiry) : null;
        
        // Check network status
        const netInfo = await NetInfo.fetch();
        this.isOnline = netInfo.isConnected && netInfo.isInternetReachable;

        // Validate token if online, allow offline if token not expired
        if (this.isOnline) {
          const validation = await this.validateTokenOnline();
          if (!validation.valid) {
            await this.logout();
            return { success: false, error: 'Token validation failed' };
          }
        }

        // Check if token is expired
        if (this.isTokenExpired()) {
          if (this.isOnline) {
            // Try to refresh token if online
            const refreshResult = await this.refreshToken();
            if (!refreshResult.success) {
              await this.logout();
              return { success: false, error: 'Token refresh failed' };
            }
          } else {
            // Allow offline usage with expired token in offline mode
            console.log('⚠️  Token expired but allowing offline usage');
            this.offlineMode = true;
            await AsyncStorage.setItem(OFFLINE_MODE_KEY, 'true');
          }
        }

        console.log('✅ User authenticated from storage');
        return { 
          success: true, 
          user: this.user, 
          token: this.token,
          offlineMode: this.offlineMode 
        };
      }

      return { success: false, message: 'No valid authentication found' };
    } catch (error) {
      console.error('Auth init error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Secure storage helper - uses SecureStore when available, falls back to AsyncStorage
   */
  async getSecureItem(key) {
    try {
      // Try SecureStore first
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue) return secureValue;
    } catch (error) {
      console.log('SecureStore not available, falling back to AsyncStorage');
    }
    
    // Fallback to AsyncStorage
    return await AsyncStorage.getItem(key);
  }

  async setSecureItem(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.log('SecureStore not available, using AsyncStorage');
      await AsyncStorage.setItem(key, value);
    }
  }

  /**
   * Sign up new user - requires online connection
   */
  async signUp(userData) {
    if (!this.isOnline) {
      return { success: false, error: 'Signup requires internet connection' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (response.ok) {
        await this.storeAuthData(data.token, data.user);
        return { success: true, user: data.user, token: data.token };
      } else {
        return { success: false, error: data.error || 'Signup failed' };
      }
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Network error during signup' };
    }
  }

  /**
   * Sign in existing user
   */
  async signIn(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        await this.storeAuthData(data.token, data.user);
        return { success: true, user: data.user, token: data.token };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error during login' };
    }
  }

  /**
   * Validate token with server (requires online)
   */
  async validateTokenOnline() {
    if (!this.token) return { valid: false };

    try {
      const response = await fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return { valid: true, user: data.user };
      } else {
        return { valid: false };
      }
    } catch (error) {
      console.error('Token validation error:', error);
      return { valid: false };
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken() {
    if (!this.token || !this.isOnline) {
      return { success: false, error: 'Cannot refresh token' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        await this.storeAuthData(data.token, data.user || this.user);
        return { success: true, token: data.token };
      } else {
        return { success: false, error: data.error || 'Token refresh failed' };
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: 'Network error during token refresh' };
    }
  }

  /**
   * Sign out user
   */
  async logout() {
    try {
      // Try server logout if online
      if (this.isOnline && this.token) {
        try {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
            },
          });
        } catch (error) {
          console.log('Server logout failed, continuing with local cleanup');
        }
      }

      // Clear all stored data
      await Promise.all([
        SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
        AsyncStorage.multiRemove([USER_DATA_KEY, TOKEN_EXPIRY_KEY, OFFLINE_MODE_KEY])
      ]);
      
      this.token = null;
      this.user = null;
      this.tokenExpiry = null;
      this.offlineMode = false;
      
      console.log('✅ User logged out');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current user data
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Get current auth token
   */
  getAuthToken() {
    return this.token;
  }

  /**
   * Check if user is authenticated (token exists and not expired, or offline mode)
   */
  isAuthenticated() {
    if (this.offlineMode) return true;
    return !!(this.token && this.user && !this.isTokenExpired());
  }

  /**
   * Check if token is expired
   */
  isTokenExpired() {
    if (!this.tokenExpiry) return false;
    return Date.now() > this.tokenExpiry;
  }

  /**
   * Check if token is valid (decode and check expiry)
   */
  isTokenValid(token) {
    try {
      if (!token) return false;
      
      // Decode JWT payload
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      return payload.exp > currentTime;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  /**
   * Store authentication data securely
   */
  async storeAuthData(token, user) {
    try {
      // Decode token to get expiry
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp * 1000; // Convert to milliseconds

      await Promise.all([
        this.setSecureItem(AUTH_TOKEN_KEY, token),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user)),
        AsyncStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString()),
        AsyncStorage.setItem(OFFLINE_MODE_KEY, 'false')
      ]);
      
      this.token = token;
      this.user = user;
      this.tokenExpiry = expiry;
      this.offlineMode = false;
      
      console.log('✅ Auth data stored securely');
      return { success: true };
    } catch (error) {
      console.error('Store auth data error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update network status
   */
  async updateNetworkStatus() {
    const netInfo = await NetInfo.fetch();
    this.isOnline = netInfo.isConnected && netInfo.isInternetReachable;
    
    if (this.isOnline && this.offlineMode) {
      // Came back online, try to validate token
      if (this.token && !this.isTokenExpired()) {
        const validation = await this.validateTokenOnline();
        if (validation.valid) {
          this.offlineMode = false;
          await AsyncStorage.setItem(OFFLINE_MODE_KEY, 'false');
          console.log('✅ Back online, token validated');
        }
      }
    }
    
    return this.isOnline;
  }

  /**
   * Get current authentication status
   */
  getAuthStatus() {
    return {
      authenticated: this.isAuthenticated(),
      user: this.user,
      offlineMode: this.offlineMode,
      tokenValid: this.token ? !this.isTokenExpired() : false,
      isOnline: this.isOnline
    };
  }
}

// Create singleton instance
const enhancedAuthService = new EnhancedAuthService();

export default enhancedAuthService;