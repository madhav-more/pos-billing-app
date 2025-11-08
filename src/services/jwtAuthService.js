import AsyncStorage from '@react-native-async-storage/async-storage';

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
      const lastVerified = await AsyncStorage.getItem('last_verified_at');
      
      if (token && userData) {
        this.token = token;
        this.user = JSON.parse(userData);
        
        // Check if token is valid (offline-first approach)
        const isValid = await this.verifyTokenOfflineFirst(lastVerified);
        
        if (isValid) {
          return {isAuthenticated: true, user: this.user};
        } else {
          // Token expired, clear auth
          await this.signOut();
          return {isAuthenticated: false, user: null};
        }
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
      // Try online signup first
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
        timeout: 5000, // 5 second timeout
      });

      const data = await response.json();

      if (response.ok) {
        await this.saveAuthData(data.token, data.user);
        return {success: true, user: data.user};
      } else {
        return {success: false, error: data.error || data.message || 'Sign up failed'};
      }
    } catch (error) {
      console.log('Backend unavailable, creating offline account:', error.message);
      
      // OFFLINE MODE: Create local account
      try {
        // Check if user already exists locally
        const existingUsers = await AsyncStorage.getItem('local_users');
        const users = existingUsers ? JSON.parse(existingUsers) : [];
        
        if (users.find(u => u.email === email)) {
          return {success: false, error: 'User already exists'};
        }
        
        // Create local user
        const localUser = {
          id: `local_${Date.now()}`,
          name,
          email,
          password, // In production, hash this!
          createdAt: new Date().toISOString(),
        };
        
        users.push(localUser);
        await AsyncStorage.setItem('local_users', JSON.stringify(users));
        
        // Create a fake JWT token for offline use (header.payload.signature format)
        const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({
          userId: localUser.id,
          email: localUser.email,
          exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
        }));
        const fakeToken = `${header}.${payload}.offline`;
        
        await this.saveAuthData(fakeToken, {
          id: localUser.id,
          name: localUser.name,
          email: localUser.email,
        });
        
        return {success: true, user: localUser, offline: true};
      } catch (offlineError) {
        console.error('Offline signup error:', offlineError);
        return {success: false, error: 'Failed to create account'};
      }
    }
  }

  // Sign in existing user
  async signIn(email, password) {
    // Check if user exists locally first (fast path)
    try {
      const existingUsers = await AsyncStorage.getItem('local_users');
      const users = existingUsers ? JSON.parse(existingUsers) : [];
      const localUser = users.find(u => u.email === email && u.password === password);
      
      if (localUser) {
        // User exists locally, login immediately (offline)
        console.log('Logging in with local account');
        const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({
          userId: localUser.id,
          email: localUser.email,
          exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        }));
        const fakeToken = `${header}.${payload}.offline`;
        
        await this.saveAuthData(fakeToken, {
          id: localUser.id,
          name: localUser.name,
          email: localUser.email,
        });
        
        return {success: true, user: localUser, offline: true};
      }
    } catch (localCheckError) {
      console.log('Local user check failed:', localCheckError.message);
    }

    // Try online login if user not found locally
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok) {
        await this.saveAuthData(data.token, data.user);
        return {success: true, user: data.user};
      } else {
        return {success: false, error: data.error || data.message || 'Sign in failed'};
      }
    } catch (error) {
      console.log('Backend unavailable:', error.message);
      return {success: false, error: 'Invalid email or password'};
    }
  }

  // Save authentication data to storage
  async saveAuthData(token, user) {
    try {
      const now = new Date().toISOString();
      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('user_data', JSON.stringify(user));
      await AsyncStorage.setItem('last_verified_at', now);
      
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
      await AsyncStorage.removeItem('last_verified_at');
      
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

  // Offline-first token verification
  async verifyTokenOfflineFirst(lastVerified) {
    if (!this.token) {
      return false;
    }

    try {
      // Check if it's an offline token
      if (this.token.endsWith('.offline')) {
        // Offline tokens are always valid (they don't expire in offline mode)
        return true;
      }

      // Try to decode JWT locally
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);

      // Check if token is expired
      if (payload.exp && payload.exp < currentTime) {
        return false;
      }

      // Check last verification time (allow 7 days offline)
      const OFFLINE_EXPIRY_DAYS = 7;
      if (lastVerified) {
        const lastVerifiedDate = new Date(lastVerified);
        const daysSinceVerification =
          (Date.now() - lastVerifiedDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceVerification > OFFLINE_EXPIRY_DAYS) {
          // Try to verify with server if online
          const serverVerified = await this.tryVerifyWithServer();
          if (serverVerified) {
            // Update last verified time
            await AsyncStorage.setItem('last_verified_at', new Date().toISOString());
            return true;
          }
          return false;
        }
      }

      // Token is valid and within offline window
      return true;
    } catch (error) {
      console.error('Token verification error:', error);
      // If verification fails but token exists, assume it's valid (offline-first)
      return true;
    }
  }

  // Try to verify token with server (non-blocking)
  async tryVerifyWithServer() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      // Network error, allow offline access
      console.log('Server verification failed, allowing offline access');
      return false;
    }
  }
}

// Export singleton instance
export default new JWTAuthService();
