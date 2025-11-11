import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {StatusBar} from 'expo-status-bar';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {store, persistor} from './src/store';
import {database} from './src/db';
import {seedDatabase} from './src/db/seed-script';
import {CartProvider} from './src/context/CartContext';
import {autoSync} from './src/services/cloudSyncService';
import simpleAuthService from './src/services/simpleAuthService';
import syncManager from './src/services/syncManager';

// Screens
import SplashScreen from './src/screens/SplashScreen';
import SimpleLoginScreen from './src/screens/SimpleLoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ScannerScreen from './src/screens/ImprovedScannerScreen';
import CounterScreen from './src/screens/CounterScreen';
import ItemsScreen from './src/screens/ItemsScreen';
import EnhancedSettingsScreen from './src/screens/EnhancedSettingsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import PaymentSuccessScreen from './src/screens/PaymentSuccessScreen';
import PaymentModeScreen from './src/screens/PaymentModeScreen';
import SelectItemScreen from './src/screens/SelectItemScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({onLogout}) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6B46C1',
        tabBarInactiveTintColor: '#999',
      }}>
      <Tab.Screen name="Today" component={HomeScreen} />
      <Tab.Screen name="Counter" component={CounterScreen} />
      <Tab.Screen name="Items" component={ItemsScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="More">
        {props => <EnhancedSettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasUserProfile, setHasUserProfile] = useState(false);
  const [user, setUser] = useState(null);
  const [forceRefresh, setForceRefresh] = useState(0);

  useEffect(() => {
    initializeApp();
  }, [forceRefresh]);

  // Separate effect for sync manager
  useEffect(() => {
    if (hasUserProfile) {
      syncManager.initialize();
      return () => {
        syncManager.cleanup();
      };
    }
  }, [hasUserProfile]);

  const initializeApp = async () => {
    try {
      // Check if user profile exists
      const profileState = await simpleAuthService.initialize();
      console.log('🚀 App initialization - Has profile:', profileState.hasUser);
      setHasUserProfile(profileState.hasUser);
      setUser(profileState.user);
      
      // Seed database if needed (only on first run)
      if (profileState.hasUser) {
        const itemsCollection = database.collections.get('items');
        const items = await itemsCollection.query().fetch();
        
        if (items.length === 0) {
          console.log('📦 Seeding initial items...');
          await seedDatabase();
        }
      }
      
      // End loading
      setIsLoading(false);

      // Auto-sync with cloud in background (non-blocking)
      if (profileState.hasUser) {
        setTimeout(() => {
          autoSync().catch(err => console.log('Auto-sync skipped:', err.message));
        }, 2000);
      }
    } catch (error) {
      console.error('App initialization error:', error);
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setForceRefresh(prev => prev + 1);
    setIsLoading(true);
  };

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <GestureHandlerRootView style={{flex: 1}}>
          <StatusBar style="light" />
          <CartProvider>
            <NavigationContainer>
          <Stack.Navigator screenOptions={{headerShown: false}}>
            {(() => {
              console.log('🧭 Navigation state - isLoading:', isLoading, 'hasUserProfile:', hasUserProfile);
              return null;
            })()}
            {isLoading ? (
              <Stack.Screen name="Splash" component={SplashScreen} />
            ) : !hasUserProfile ? (
              <Stack.Screen name="Login">
                {props => <SimpleLoginScreen {...props} onLoginComplete={() => {
                  console.log('✅ Login complete');
                  setForceRefresh(prev => prev + 1);
                }} />}
              </Stack.Screen>
            ) : (
              <>
                <Stack.Screen name="MainTabs">
                  {props => <MainTabs {...props} onLogout={handleLogout} />}
                </Stack.Screen>
                <Stack.Screen
                  name="Scanner"
                  component={ScannerScreen}
                  options={{presentation: 'modal'}}
                />
                <Stack.Screen
                  name="PaymentMode"
                  component={PaymentModeScreen}
                  options={{headerShown: false}}
                />
                <Stack.Screen
                  name="PaymentSuccess"
                  component={PaymentSuccessScreen}
                  options={{headerShown: false}}
                />
                <Stack.Screen
                  name="SelectItem"
                  component={SelectItemScreen}
                  options={{headerShown: false}}
                />
              </>
            )}
          </Stack.Navigator>
            </NavigationContainer>
          </CartProvider>
        </GestureHandlerRootView>
      </PersistGate>
    </Provider>
  );
}

export default App;
