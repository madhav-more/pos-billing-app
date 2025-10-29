import AsyncStorage from '@react-native-async-storage/async-storage';
import {database} from '../db/database';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

class JWTAuthService {
  constructor() {
    this.token = null;
    this.user = null;
  }

  // Initialize auth state from storage
  async initialize() {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userData = await AsyncStorage.getItem('user_data');
      
      if (token && userData) {
        this.token = token;
        this.user = JSON.parse(userData);
        return {isAuthenticated: true, user: this.user};
      }
      
      return {isAuthenticated: false, user: null};
    } catch (error) {
      console.error('Auth initialization error:', error);
      return {isAuthenticated: false, user: null};
    }
  }

  // Sign up new user
  async signUp(email, password, name) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          name,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await this.saveAuthData(data.token, data.user);
        return {success: true, user: data.user};
      } else {
        return {success: false, error: data.message || 'Sign up failed'};
      }
    } catch (error) {
      console.error('Sign up error:', error);
      return {success: false, error: 'Network error. Please try again.'};
    }
  }

  // Sign in existing user
  async signIn(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await this.saveAuthData(data.token, data.user);
        return {success: true, user: data.user};
      } else {
        return {success: false, error: data.message || 'Sign in failed'};
      }
    } catch (error) {
      console.error('Sign in error:', error);
      return {success: false, error: 'Network error. Please try again.'};
    }
  }

  // Save authentication data to storage
  async saveAuthData(token, user) {
    try {
      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('user_data', JSON.stringify(user));
      
      this.token = token;
      this.user = user;
    } catch (error) {
      console.error('Error saving auth data:', error);
    }
  }

  // Sign out user
  async signOut() {
    try {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user_data');
      
      this.token = null;
      this.user = null;
      
      return {success: true};
    } catch (error) {
      console.error('Sign out error:', error);
      return {success: false, error: 'Failed to sign out'};
    }
  }

  // Get current user
  getCurrentUser() {
    return this.user;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  // Get auth token
  getToken() {
    return this.token;
  }

  // Verify token locally (for offline use)
  async verifyTokenLocally() {
    if (!this.token) {
      return false;
    }

    try {
      // Simple JWT decode (without verification for offline use)
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Check if token is expired
      if (payload.exp && payload.exp < currentTime) {
        await this.signOut();
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Token verification error:', error);
      await this.signOut();
      return false;
    }
  }

  // Verify token with server (for online use)
  async verifyTokenWithServer() {
    if (!this.token) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        return true;
      } else {
        await this.signOut();
        return false;
      }
    } catch (error) {
      console.error('Server token verification error:', error);
      // If network error, fall back to local verification
      return await this.verifyTokenLocally();
    }
  }

  // Get authenticated headers for API calls
  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  // Make authenticated API call
  async authenticatedFetch(url, options = {}) {
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }
}

// Export singleton instance
export default new JWTAuthService();
