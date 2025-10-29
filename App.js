import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {StatusBar} from 'expo-status-bar';
import {database} from './src/db';
import {seedDatabase} from './src/db/seed-script';
import {CartProvider} from './src/context/CartContext';
import {autoSync} from './src/services/cloudSyncService';
import jwtAuthService from './src/services/jwtAuthService';

// Screens
import SplashScreen from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import ScannerScreen from './src/screens/ImprovedScannerScreen';
import CounterScreen from './src/screens/CounterScreen';
import ItemsScreen from './src/screens/ItemsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
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
        {props => <SettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [forceRefresh, setForceRefresh] = useState(0);

  useEffect(() => {
    initializeApp();
  }, [forceRefresh]);

  const initializeApp = async () => {
    try {
      // Initialize authentication
      const authState = await jwtAuthService.initialize();
      setIsAuthenticated(authState.isAuthenticated);
      setUser(authState.user);
      
      const settingsCollection = database.collections.get('settings');
      const itemsCollection = database.collections.get('items');
      
      const settings = await settingsCollection.query().fetch();
      const items = await itemsCollection.query().fetch();

      // Only seed if database is completely empty
      if (settings.length === 0 && items.length === 0) {
        console.log('Database empty, seeding...');
        await seedDatabase();
        // Re-fetch after seeding
        const updatedSettings = await settingsCollection.query().fetch();
        const onboardingSetting = updatedSettings.find(s => s.key === 'hasOnboarded');
        setIsOnboarded(onboardingSetting?.value === 'true');
      } else {
        // Database has data, just check onboarding status
        console.log('Database has data, items:', items.length, 'settings:', settings.length);
        const onboardingSetting = settings.find(s => s.key === 'hasOnboarded');
        setIsOnboarded(onboardingSetting?.value === 'true');
      }

      // Auto-sync with cloud if authenticated
      if (authState.isAuthenticated) {
        autoSync().catch(err => console.error('Auto-sync failed:', err));
      }
      
      setTimeout(() => setIsLoading(false), 1000);
    } catch (error) {
      console.error('App initialization error:', error);
      setIsLoading(false);
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      const settingsCollection = database.collections.get('settings');
      const settings = await settingsCollection.query().fetch();
      const onboardingSetting = settings.find(s => s.key === 'hasOnboarded');
      setIsOnboarded(onboardingSetting?.value === 'true');
    } catch (error) {
      console.error('Error checking onboarding:', error);
    }
  };

  const handleLogout = () => {
    setForceRefresh(prev => prev + 1);
    setIsLoading(true);
  };

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <StatusBar style="light" />
      <CartProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{headerShown: false}}>
            {isLoading ? (
              <Stack.Screen name="Splash" component={SplashScreen} />
            ) : !isOnboarded ? (
              <Stack.Screen name="Onboarding">
                {props => <OnboardingScreen {...props} onComplete={checkOnboardingStatus} />}
              </Stack.Screen>
            ) : !isAuthenticated ? (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Signup" component={SignupScreen} />
              </>
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
  );
}

export default App;
