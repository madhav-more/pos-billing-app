import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_PROFILE_KEY = 'user_profile';

/**
 * Simple User Profile Service
 * No JWT, no passwords, just basic user info stored locally
 */
class UserProfileService {
  constructor() {
    this.currentUser = null;
  }

  /**
   * Initialize and check if user exists
   */
  async initialize() {
    try {
      const profileData = await AsyncStorage.getItem(USER_PROFILE_KEY);
      if (profileData) {
        this.currentUser = JSON.parse(profileData);
        console.log('✅ User profile loaded:', this.currentUser.email);
        return { hasUser: true, user: this.currentUser };
      }
      console.log('ℹ️ No user profile found');
      return { hasUser: false, user: null };
    } catch (error) {
      console.error('Error loading user profile:', error);
      return { hasUser: false, user: null };
    }
  }

  /**
   * Create or update user profile
   */
  async saveProfile(profileData) {
    try {
      const { name, email, shopName, phone, location } = profileData;

      if (!email) {
        return { success: false, error: 'Email is required' };
      }

      const userProfile = {
        email,
        name: name || '',
        shopName: shopName || 'My Store',
        phone: phone || '',
        location: location || '',
        createdAt: this.currentUser?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(userProfile));
      this.currentUser = userProfile;

      console.log('✅ User profile saved:', email);
      return { success: true, user: userProfile };
    } catch (error) {
      console.error('Error saving user profile:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if user exists (for login)
   */
  async checkUserExists(email) {
    const { hasUser, user } = await this.initialize();
    return hasUser && user.email === email;
  }

  /**
   * Clear user profile (logout)
   */
  async clearProfile() {
    try {
      await AsyncStorage.removeItem(USER_PROFILE_KEY);
      this.currentUser = null;
      console.log('✅ User profile cleared');
      return { success: true };
    } catch (error) {
      console.error('Error clearing user profile:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return !!this.currentUser;
  }
}

// Export singleton instance
export default new UserProfileService();
