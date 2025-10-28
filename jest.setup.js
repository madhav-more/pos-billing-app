import '@testing-library/react-native/extend-expect';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve('mock-token')),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock/documents/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
  getInfoAsync: jest.fn(() => Promise.resolve({exists: true})),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  EncodingType: {UTF8: 'utf8'},
}));

// Mock expo-barcode-scanner
jest.mock('expo-barcode-scanner', () => ({
  BarCodeScanner: {
    requestPermissionsAsync: jest.fn(() => Promise.resolve({status: 'granted'})),
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-key',
      },
    },
  },
}));

// Mock WatermelonDB
jest.mock('@nozbe/watermelondb/adapters/sqlite', () => ({
  default: jest.fn(),
}));
