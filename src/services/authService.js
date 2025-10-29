import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';
const API_BASE_URL = 'http://localhost:3000/api'; // Update with your backend URL

/**
 * JWT Authentication Service with AsyncStorage
 * Provides offline verification and cloud sync capabilities
 */
class AuthService {
  constructor() {
    this.token = null;
    this.user = null;
    this.isOnline = false;
    this.init();
  }

  async init() {
    try {
      // Load stored token and user data
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(USER_DATA_KEY)
      ]);

      if (storedToken && storedUser) {
        this.token = storedToken;
        this.user = JSON.parse(storedUser);
        
        // Verify token is still valid
        if (this.isTokenValid(storedToken)) {
          console.log('✅ User authenticated from storage');
          return { success: true, user: this.user, token: this.token };
        } else {
          // Token expired, clear storage
          await this.logout();
        }
      }

      // Check network status
      const netInfo = await NetInfo.fetch();
      this.isOnline = netInfo.isConnected && netInfo.isInternetReachable;

      return { success: false, message: 'No valid authentication found' };
    } catch (error) {
      console.error('Auth init error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign up new user
   */
  async signUp(userData) {
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
   * Sign out user
   */
  async logout() {
    try {
      await Promise.all([
        AsyncStorage.removeItem(AUTH_TOKEN_KEY),
        AsyncStorage.removeItem(USER_DATA_KEY)
      ]);
      
      this.token = null;
      this.user = null;
      
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
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!(this.token && this.user && this.isTokenValid(this.token));
  }

  /**
   * Check if token is valid (not expired)
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
   * Store authentication data
   */
  async storeAuthData(token, user) {
    try {
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, token),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user))
      ]);
      
      this.token = token;
      this.user = user;
      
      console.log('✅ Auth data stored');
      return { success: true };
    } catch (error) {
      console.error('Store auth data error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh token (if needed)
   */
  async refreshToken() {
    if (!this.isOnline) {
      return { success: false, error: 'Offline - cannot refresh token' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        await this.storeAuthData(data.token, this.user);
        return { success: true, token: data.token };
      } else {
        // Token refresh failed, logout user
        await this.logout();
        return { success: false, error: 'Token refresh failed' };
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: 'Network error during token refresh' };
    }
  }

  /**
   * Make authenticated API request
   */
  async authenticatedRequest(url, options = {}) {
    if (!this.isAuthenticated()) {
      return { success: false, error: 'Not authenticated' };
    }

    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // If token expired, try to refresh
      if (response.status === 401) {
        const refreshResult = await this.refreshToken();
        if (refreshResult.success) {
          // Retry with new token
          headers.Authorization = `Bearer ${this.token}`;
          const retryResponse = await fetch(url, {
            ...options,
            headers,
          });
          return { success: true, response: retryResponse };
        } else {
          return { success: false, error: 'Authentication failed' };
        }
      }

      return { success: true, response };
    } catch (error) {
      console.error('Authenticated request error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update network status
   */
  updateNetworkStatus(isOnline) {
    this.isOnline = isOnline;
  }

  /**
   * Get network status
   */
  getNetworkStatus() {
    return this.isOnline;
  }
}

// Export singleton instance
export default new AuthService();
