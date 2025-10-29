import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert} from 'react-native';
import {database} from '../db';
import jwtAuthService from '../services/jwtAuthService';

export default function SettingsScreen({navigation, onLogout}) {
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    shopName: '',
    location: '',
    authMode: 'local',
  });

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const currentUser = jwtAuthService.getCurrentUser();
      const settingsCollection = database.collections.get('settings');
      const settings = await settingsCollection.query().fetch();

      const name = currentUser?.name || settings.find(s => s.key === 'ownerName')?.value || 'User';
      const email = currentUser?.email || settings.find(s => s.key === 'userEmail')?.value || '';
      const shopName = settings.find(s => s.key === 'shopName')?.value || 'G.U.R.U Store';
      const location = settings.find(s => s.key === 'location')?.value || '';
      const authMode = jwtAuthService.isAuthenticated() ? 'cloud' : 'local';

      setUserInfo({name, email, shopName, location, authMode});
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              if (userInfo.authMode === 'cloud') {
                await jwtAuthService.signOut();
              }
              
              // Mark as logged out but keep data
              await database.write(async () => {
                const settingsCollection = database.collections.get('settings');
                const settings = await settingsCollection.query().fetch();
                const hasOnboarded = settings.find(s => s.key === 'hasOnboarded');
                if (hasOnboarded) {
                  await hasOnboarded.update(s => {
                    s.value = 'false';
                  });
                }
              });

              // Trigger app refresh to show onboarding
              if (onLogout) {
                onLogout();
              }
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', error.message || 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{userInfo.name.charAt(0).toUpperCase()}</Text>
          </View>
          
          <Text style={styles.userName}>{userInfo.name}</Text>
          {userInfo.email && <Text style={styles.userEmail}>{userInfo.email}</Text>}
          <Text style={styles.authBadge}>
            {userInfo.authMode === 'cloud' ? '☁️ Cloud Account' : '📱 Local Account'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shop Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Shop Name</Text>
            <Text style={styles.infoValue}>{userInfo.shopName}</Text>
          </View>

          {userInfo.location && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{userInfo.location}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Database</Text>
            <Text style={styles.infoValue}>LokiJS (Offline-first)</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#6B46C1',
    padding: 16,
    paddingTop: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  authBadge: {
    fontSize: 12,
    color: '#6B46C1',
    backgroundColor: '#E9D8FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  spacer: {
    height: 100,
  },
});
