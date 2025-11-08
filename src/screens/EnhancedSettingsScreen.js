import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator} from 'react-native';
import {database} from '../db';
import enhancedAuthService from '../services/enhancedAuthService';
import comprehensiveSyncService from '../services/comprehensiveSyncService';

export default function EnhancedSettingsScreen({navigation, onLogout}) {
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    shopName: '',
    location: '',
    authMode: 'local',
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const currentUser = enhancedAuthService.getCurrentUser();
      const settingsCollection = database.collections.get('settings');
      const settings = await settingsCollection.query().fetch();

      const name = currentUser?.name || settings.find(s => s.key === 'ownerName')?.value || 'User';
      const email = currentUser?.email || settings.find(s => s.key === 'userEmail')?.value || '';
      const shopName = settings.find(s => s.key === 'shopName')?.value || 'G.U.R.U Store';
      const location = settings.find(s => s.key === 'location')?.value || '';
      const authStatus = enhancedAuthService.getAuthStatus();
      const authMode = authStatus.authenticated ? 'cloud' : 'local';

      setUserInfo({name, email, shopName, location, authMode});
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const handleSyncNow = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncStatus('Syncing...');

    try {
      const result = await comprehensiveSyncService.performFullSync({showNotification: true});
      
      if (result.success) {
        setSyncStatus(`✅ Sync completed!\nPushed: ${result.pushed}, Pulled: ${result.pulled}`);
        setLastSyncTime(new Date().toLocaleTimeString());
        
        setTimeout(() => {
          setSyncStatus(null);
        }, 3000);

        Alert.alert(
          'Sync Successful',
          `All data synced!\nPushed: ${result.pushed} items\nPulled: ${result.pulled} items`,
          [{text: 'OK'}]
        );
      } else {
        setSyncStatus(`❌ Sync failed: ${result.error}`);
        Alert.alert('Sync Failed', result.error || 'Failed to sync data');
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('❌ Sync error');
      Alert.alert('Error', 'An error occurred during sync');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncAndLogout = () => {
    Alert.alert(
      'Sync & Logout',
      'This will sync all your data with the cloud before logging out. Continue?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Sync & Logout',
          style: 'destructive',
          onPress: async () => {
            setIsSyncing(true);
            setSyncStatus('Syncing before logout...');

            try {
              const result = await comprehensiveSyncService.syncAndLogout();
              
              if (result.success) {
                setSyncStatus('✅ Synced and logged out successfully!');
                
                setTimeout(() => {
                  if (onLogout) {
                    onLogout();
                  }
                }, 1000);
              } else {
                setSyncStatus(`Sync error: ${result.syncResult?.error || result.error}`);
                Alert.alert('Warning', 'Logout attempted despite sync error. Please try again.');
              }
            } catch (error) {
              console.error('Sync and logout error:', error);
              setSyncStatus('Error during sync and logout');
              Alert.alert('Error', 'An error occurred. Please try again.');
            } finally {
              setIsSyncing(false);
            }
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout without syncing?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await enhancedAuthService.logout();
              
              if (onLogout) {
                onLogout();
              }
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', error.message || 'Failed to logout');
            }
          },
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
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
          <Text style={styles.sectionTitle}>Sync Status</Text>
          
          {lastSyncTime && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Sync</Text>
              <Text style={styles.infoValue}>{lastSyncTime}</Text>
            </View>
          )}

          {syncStatus && (
            <View style={styles.syncStatusBox}>
              <Text style={styles.syncStatusText}>{syncStatus}</Text>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.syncButton, isSyncing && styles.disabledButton]} 
            onPress={handleSyncNow}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.syncButtonText}>Syncing...</Text>
              </>
            ) : (
              <Text style={styles.syncButtonText}>🔄 Sync Now</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity 
            style={styles.syncLogoutButton} 
            onPress={handleSyncAndLogout}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.syncLogoutButtonText}>Syncing...</Text>
              </>
            ) : (
              <Text style={styles.syncLogoutButtonText}>☁️ Sync & Logout</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
            disabled={isSyncing}
          >
            <Text style={styles.logoutButtonText}>Logout (without sync)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Database</Text>
            <Text style={styles.infoValue}>WatermelonDB (Offline-first)</Text>
          </View>
        </View>

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
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
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
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  syncStatusBox: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6B46C1',
  },
  syncStatusText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  syncLogoutButton: {
    backgroundColor: '#00C853',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  syncLogoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  spacer: {
    height: 20,
  },
});
